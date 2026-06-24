import uWS from 'uWebSockets.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ServerClientManager } from '../client/ServerClientManager.js';
import { ServerIpManager } from '../ip/ServerIpManager.js';
import { ServerWorldManager } from '../world/ServerWorldManager.js';
import { ServerRegionManager } from '../region/ServerRegionManager.js';
import { StatsTracker } from '../stats/StatsTracker.js';
import { data as miscData, saveAndClose } from "./miscData.js";
import { handleRequest as handleApiRequest } from "../api/api.js";
import { getIpFromHeader, RANK } from "../util/util.js";
import { loadCommands } from "../cmd/commandHandler.js";

let textEncoder = new TextEncoder();
let textDecoder = new TextDecoder();

export class Server {
	constructor(config) {
		this.config = config;

		loadCommands();

		this.clients = new ServerClientManager(this);
		this.ips = new ServerIpManager(this);
		this.worlds = new ServerWorldManager(this);
		this.regions = new ServerRegionManager(this);

		this.listenSocket = null;
		this.wsServer = this.createServer();
		this.globalTopic = Uint8Array.from([0x00]).buffer;
		this.adminTopic = Uint8Array.from([0x01]).buffer;

		this.currentTick = 0;
		this.nextTickTime = performance.now() + 1000 / 15;
		this.tickTimeout = this.setTickTimeout();

		this.stats = new StatsTracker(this);

		this.whitelistId = miscData.whitelistId;
		this.lockdown = false;

		this.destroyed = false;
	}

	async destroy(reason) {
		if (this.destroyed) return;
		this.destroyed = true;
		this.adminMessage("DEVServer shutdown initiated.");
		clearTimeout(this.tickTimeout);
		if (this.listenSocket) uWS.us_listen_socket_close(this.listenSocket);
		this.clients.destroy(reason);
		await this.worlds.destroy();
		await this.regions.destroy();
		await this.ips.destroy();
		await saveAndClose();
	}

	getClientsByUsername(username) {
		let c = [];
		for (let client of this.clients.map.values()) {
			if (client.getAccountUsername() === username) c.push(client);
		}
		return c;
	}

	getClientByUsername(username) {
		for (let client of this.clients.map.values()) {
			if (client.getAccountUsername() === username) return client;
		}
		return null;
	}

	createServer() {
		let server;
		if (process.env.HTTPS === "true") {
			let options = {}
			if (process.env.CERT_FILE_NAME) options.cert_file_name = process.env.CERT_FILE_NAME
			if (process.env.DH_PARAMS_FILE_NAME) options.dh_params_file_name = process.env.DH_PARAMS_FILE_NAME
			if (process.env.KEY_FILE_NAME) options.key_file_name = process.env.KEY_FILE_NAME
			if (process.env.PASSPHRASE) options.passphrase = process.env.PASSPHRASE
			server = uWS.SSLApp(options);
		} else {
			server = uWS.App();
		}
		server.ws("/*", {
			maxPayloadLength: 1 << 15,
			maxBackpressure: 2 << 21,
			idleTimeout: 60,
			sendPingsAutomatically: true,
			upgrade: async (res, req, context) => {
				try {
					//read headers
					let secWebSocketKey = req.getHeader("sec-websocket-key");
					let secWebSocketProtocol = req.getHeader("sec-websocket-protocol");
					let secWebSocketExtensions = req.getHeader("sec-websocket-extensions");
					let origin = req.getHeader("origin");
					let cookies = req.getHeader('cookie');
					let token = '';
					let isBot = req.getHeader('is-bot') === true || req.getHeader('is-bot') == "true" || false; // change to false before pushing you fucking maggot
					token = cookies.split('; ').map(cookie => cookie.split('='))
						.reduce((acc, [key, value]) => {
							acc[key] = value;
							return acc;
						}, {})['nmToken'] || null;
					// console.log(cookies);
					// console.log(token.toString());
					// console.log('fart');
					//handle abort
					let aborted = false;
					res.onAborted(() => {
						aborted = true;
					});
					//async get ip data, then upgrade
					let ip;
					if (process.env.IS_PROXIED === "true") ip = getIpFromHeader(req.getHeader(process.env.REAL_IP_HEADER));
					else ip = textDecoder.decode(res.getRemoteAddressAsText());
					ip = await this.ips.fetch(ip);
					if (aborted) return;
					if (this.destroyed) {
						res.writeStatus("503 Service Unavailable");
						res.end();
					} else {
						res.cork(() => {
							res.upgrade({
								origin,
								ip,
								closed: false,
								token,
								isBot,
							}, secWebSocketKey, secWebSocketProtocol, secWebSocketExtensions, context);
						});
					}
				} catch (error) {
					console.error(error);
				}
			},
			open: async ws => {
				ws.subscribe(this.globalTopic);
				try {
					this.stats.totalConnections++;
					let client = this.clients.createClient(ws);
					ws.client = client;
					await client.setStatus("Logging in...", true, true);
					if (!await client.checkIsLoggedIn()) return;
					if (client.destroyed) return;
					await client.setStatus("Logged in!", true);
					client.startProtocol();
				}
				catch (err) {
					console.error(err);
				}
			},
			message: (ws, message, isBinary) => {
				try {
					ws.client.handleMessage(message, isBinary);
				}
				catch (err) {
					console.error(err);
				}
			},
			close: (ws, code, message) => {
				try {
					ws.closed = true;
					if (!ws.client.destroyed) ws.client.destroy();
				}
				catch (err) {
					console.error(err);
				}
			}
		});
		this.createApiHandlers(server);

		const __dirname = path.dirname(fileURLToPath(import.meta.url));
		const staticDir = path.resolve(__dirname, '../../../../client/dist');
		const mimeTypes = {
			'.html': 'text/html', '.js': 'application/javascript',
			'.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg',
			'.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
			'.mp3': 'audio/mpeg', '.woff': 'font/woff', '.woff2': 'font/woff2',
			'.ttf': 'font/ttf', '.json': 'application/json',
		};
		server.get('/*', (res, req) => {
			let urlPath = req.getUrl();
			if (urlPath === '/' || !path.extname(urlPath)) urlPath = '/index.html';
			const filePath = path.join(staticDir, urlPath);
			try {
				const data = fs.readFileSync(filePath);
				const ext = path.extname(filePath);
				res.writeHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
				res.end(data);
			} catch {
				try {
					const data = fs.readFileSync(path.join(staticDir, 'index.html'));
					res.writeHeader('Content-Type', 'text/html');
					res.end(data);
				} catch {
					res.writeStatus('404 Not Found').end();
				}
			}
		});
		server.any('/*', (res, req) => {
			res.writeStatus("400 Bad Request");
			res.end();
		});
		const port = parseInt(process.env.PORT || process.env.WS_PORT || 8081);
		server.listen(port, listenSocket => {
			this.listenSocket = listenSocket;
			console.log(`Server listening on port ${port}`);
		});
		return server;
	}

	setTickTimeout() {
		let timeUntilTick = this.nextTickTime - performance.now();
		if (timeUntilTick < -5000) console.warn(`Ticking behind by ${Math.round(-timeUntilTick)}ms`);
		this.tickTimeout = setTimeout(this.tick.bind(this), timeUntilTick);
	}

	tick() {
		let tick = ++this.currentTick;
		this.nextTickTime = performance.now() + 1000 / 15;
		this.setTickTimeout();

		if ((tick % 15) === 0) {
			this.clients.tickExpiration(tick);
			this.worlds.tickExpiration(tick);
			this.ips.tickExpiration(tick);
		}
		if ((tick % 54000) === 0) {
			this.stats.tickPixels();
		}
		this.clients.tick(tick);
		this.worlds.tick(tick);
	}

	adminMessage(message) {
		let arrayBuffer = textEncoder.encode(message).buffer;
		this.wsServer.publish(this.adminTopic, arrayBuffer, false);
	}

	broadcastBuffer(buffer) {
		let arrayBuffer = buffer.buffer;
		this.wsServer.publish(this.globalTopic, arrayBuffer, true);
	}

	broadcastMessage(message) {
		this.wsServer.publish(this.globalTopic, JSON.stringify(message), false);
		// this.wsServer.publish(this.globalTopic, JSON.stringify({
		// 	sender: 'server',
		// 	data: {
		// 		type: 'serverBroadcast',
		// 		senderNick: client.getNick(),
		// 		senderRank: client.rank,
		// 		senderId: client.uid,
		// 	},
		// 	text: message
		// }), false);
	}

	sendBroadcast(client, message, sender = 'player', data = null) {
		if (!data) {
			data = {
				senderId: client.uid,
				senderNick: client.getNick(),
				senderRank: client.rank,
				isLocalStaff: client.localStaff,
				type: 'broadcastMessage',
			};
		}
		this.broadcastMessage({
			sender,
			data,
			text: message
		});
	}

	resetWhitelist() {
		this.whitelistId++;
		miscData.whitelistId = this.whitelistId;
	}

	kickNonAdmins() {
		let count = 0;
		for (let client of this.clients.map.values()) {
			if (client.rank >= RANKADMIN) continue;
			client.destroy();
			count++;
		}
		return count;
	}

	setLockdown(state) {
		this.lockdown = state;
		this.adminMessage(`DEVLockdown mode ${state ? "enabled" : "disabled"}.`);
		if (!state) return;
		for (let client of this.clients.map.values()) {
			if (client.rank >= RANKADMIN) continue;
			if (client.ip.isWhitelisted()) continue;
			client.ip.setProp("whitelist", this.whitelistId);
		}
	}

	checkLockdown() {
		for (let client of this.clients.map.values()) {
			if (client.rank >= RANKADMIN) continue;
			if (client.ip.isWhitelisted()) continue;
			return;
		}
		this.setLockdown(false);
	}

	createApiHandlers(server) {
		server.any('/api', (res, req) => {
			handleApiRequest(this, res, req);
		});
		server.any('/api/*', (res, req) => {
			handleApiRequest(this, res, req);
		});
	}
}

