"use strict"; // a bunch of pre defined variables either dynamic/static or otherwise usable by all other files in the codebase

import { eventSys, propertyDefaults, getTime, absMod, escapeHTML, mkHTML, setTooltip, waitFrames, line, loadScript, getDefaultWorld } from "./util.js";
import unloadedPat from "../img/unloaded.png";
import launchSoundUrl from "../audio/launch.mp3";
import placeSoundUrl from "../audio/place.mp3";
import clickSoundUrl from "../audio/click.mp3";

export const RANK = {
	NONE: 0,
	USER: 1,
	// DONOR: 2,
	ARTIST: 2,
	MODERATOR: 3,
	ADMIN: 4,
	DEVELOPER: 5,
	OWNER: 6,
};

export const PublicAPI = window.NWOP = window.WorldOfPixels = window.OWOP = {
	RANK: RANK,
	util: {
		getTime,
		absMod,
		escapeHTML,
		mkHTML,
		setTooltip,
		waitFrames,
		line,
		loadScript
	},
	eventSys: eventSys
};

export const options = PublicAPI.options = propertyDefaults(userOptions, {
	serverAddress: [{
		default: true,
		title: 'Official Server',
		proto: 'v1',
		url: (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host,
		// url: "ws://losercity.neomoth.dev/",
	}],
	fallbackFps: 30,
	maxChatBuffer: 512,
	tickSpeed: 30,
	minGridZoom: 1,
	movementSpeed: 1,
	defaultWorld: getDefaultWorld(),
	enableSounds: true,
	enableIdView: true,
	defaultZoom: 15,
	zoomStrength: 1,
	zoomLimitMin: 1,
	zoomLimitMax: 32,
	unloadDistance: 10,
	unloadedPatternUrl: unloadedPat,
	noUi: false,
	backgroundUrl: null,
	hexCoords: false,
	showProtectionOutlines: true,
	showPlayers: true,
});

export const soundSys = PublicAPI.soundSys = {
	launchAudio: new Audio(launchSoundUrl),
	placeAudio: new Audio(placeSoundUrl),
	clickAudio: new Audio(clickSoundUrl),
	launchLastPlayed: 0,
	placeLastPlayed: 0,
	clickLastPlayed: 0,
	launch: function () {
		if (!options.enableSounds) return;
		let currentTime = Date.now();
		// if (currentTime - this.clickLastPlayed < 0) return;

		this.launchAudio.currentTime = 0;
		this.launchAudio.play();
		this.launchLastPlayed = currentTime;
	},
	place: function () {
		if (!options.enableSounds) return;
		let currentTime = Date.now();
		// if (currentTime - this.clickLastPlayed < 0) return;

		this.placeAudio.currentTime = 0;
		this.placeAudio.play();
		this.placeLastPlayed = currentTime;
	},
	click: function () {
		if (!options.enableSounds) return;
		let currentTime = Date.now();
		// if (currentTime - this.clickLastPlayed < 0) return;

		this.clickAudio.currentTime = 0;
		this.clickAudio.play();
		this.clickLastPlayed = currentTime;
	}
};

export const activeFx = [];

let evtId = 0;

export const keysDown = {};

export const EVENTS = PublicAPI.events = {
	loaded: ++evtId,
	init: ++evtId,
	tick: ++evtId,
	misc: {
		toolsRendered: ++evtId,
		toolsInitialized: ++evtId,
		worldInitialized: ++evtId,
		windowAdded: ++evtId,
		windowClosed: ++evtId,
		captchaToken: ++evtId,
		loadingCaptcha: ++evtId,
		secondaryColorSet: ++evtId,
	},
	renderer: {
		addChunk: ++evtId,
		rmChunk: ++evtId,
		updateChunk: ++evtId,
	},
	camera: {
		moved: ++evtId,
		zoom: ++evtId,
	},
	net: {
		connecting: ++evtId,
		connected: ++evtId,
		disconnected: ++evtId,
		playerCount: ++evtId,
		chat: ++evtId,
		devChat: ++evtId,
		world: {
			leave: ++evtId,
			join: ++evtId,
			joining: ++evtId,
			setId: ++evtId,
			playersMoved: ++evtId,
			playersLeft: ++evtId,
			tilesUpdated: ++evtId,
			teleported: ++evtId,
		},
		chunk: {
			load: ++evtId,
			unload: ++evtId,
			set: ++evtId,
			lock: ++evtId,
			allLoaded: ++evtId,
		},
		sec: {
			rank: ++evtId,
		},
		maxCount: ++evtId,
		donUntil: ++evtId,
	}
};

export const elements = PublicAPI.elements = {
	viewport: null,
	xyDisplay: null,
	chatInput: null,
	chat: null,
	status: null,
	windows: null,
};

export function statusMsg(showSpinner = false, message = null) {
	// const statusShown = elements.status.isConnected;
	if (elements.status) {
		if (message === null) {
			elements.status.style.display = "none";
			return;
		} else {
			elements.status.style.display = "";
		}
		elements.statusMsg.innerHTML = message;
	}
	if (elements.spinner) elements.spinner.style.display = showSpinner ? "" : "none";
}

export const KeyCode = {
	// Alphabet
	a: 65, b: 66, c: 67, d: 68, e: 69, f: 70, g: 71, h: 72, i: 73,
	j: 74, k: 75, l: 76, m: 77, n: 78, o: 79, p: 80, q: 81, r: 82,
	s: 83, t: 84, u: 85, v: 86, w: 87, x: 88, y: 89, z: 90,

	// Numbers (Top row)
	zero: 48, one: 49, two: 50, three: 51, four: 52,
	five: 53, six: 54, seven: 55, eight: 56, nine: 57,

	// Special characters and symbols
	backtick: 192, tilde: 192, dash: 189, underscore: 189,
	equals: 187, plus: 187, leftBracket: 219, leftCurly: 219,
	rightBracket: 221, rightCurly: 221, backslash: 220, pipe: 220,
	semicolon: 186, colon: 186, quote: 222, doubleQuote: 222,
	comma: 188, lessThan: 188, period: 190, greaterThan: 190,
	slash: 191, question: 191, exclamation: 49, at: 50,
	hash: 51, dollar: 52, percent: 53, caret: 54,
	ampersand: 55, asterisk: 56, leftParen: 57, rightParen: 48,

	// Function keys
	f1: 112, f2: 113, f3: 114, f4: 115, f5: 116, f6: 117,
	f7: 118, f8: 119, f9: 120, f10: 121, f11: 122, f12: 123,

	// Control keys
	enter: 13, space: 32, escape: 27, backspace: 8, tab: 9,
	shift: 16, ctrl: 17, alt: 18, capsLock: 20, pause: 19,

	// Navigation keys
	insert: 45, home: 36, delete: 46, end: 35,
	pageUp: 33, pageDown: 34,

	// Arrow keys
	arrowUp: 38, arrowDown: 40, arrowLeft: 37, arrowRight: 39,

	// Numpad keys
	numpad0: 96, numpad1: 97, numpad2: 98, numpad3: 99,
	numpad4: 100, numpad5: 101, numpad6: 102, numpad7: 103,
	numpad8: 104, numpad9: 105,
	numpadMultiply: 106, numpadAdd: 107, numpadSubtract: 109,
	numpadDecimal: 110, numpadDivide: 111, numpadEnter: 13
};

let userOptions = {};

try {
	userOptions = JSON.parse((localStorage && localStorage.getItem('nwopOptions')) || '{}');
} catch (e) {
	console.error('Error parsing user options.', e);
}

function getCookie(name) {
	let cookie = document.cookie.split(';');
	for (let i = 0; i < cookie.length; i++) {
		let index = cookie[i].indexOf(name);
		if (index === 0 || (index === 1 && cookie[i][0] === ' ')) {
			let offset = index + name.length + 1;
			return cookie[i].substring(offset, cookie[i].length);
		}
	}
	return null;
}

export const misc = PublicAPI.misc = {
	localStorage: (window && window.localStorage),
	world: null,
	get _world() {
		return this.world;
	},
	lastXYDisplay: [-1, -1],
	devRecvReader: msg => { },
	chatPostFormatRecvModifier: msg => msg,
	chatRecvModifier: msg => msg,
	chatSendModifier: msg => msg,
	exceptionTimeout: null,
	worldPasswords: {},
	tick: 0,
	urlWorldName: null,
	connecting: false,
	tickInterval: null,
	lastMessage: null,
	lastCleanup: 0,
	guiShown: false,
	showEUCookieNag: !options.noUi && navigator.cookieEnabled && getCookie('nagAccepted') !== 'true',
	usingFirefox: navigator.userAgent.indexOf('Firefox') !== -1,
	donTimer: 0
};

export let protocol = null;

eventSys.on(EVENTS.net.connecting, server => {
	protocol = server.proto;
});