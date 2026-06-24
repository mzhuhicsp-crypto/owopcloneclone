import "dotenv/config";
import { Server } from "./server/Server.js";
import readline from "readline";
import { stdin, stdout } from "process";
import fs from "fs/promises";

let rl = readline.createInterface({input: stdin, output: stdout});
rl.on('line', async d=>{
	let msg = d.toString().trim();
	try{
		console.log(eval(msg));
	}catch(e){
		console.log(e.name+": "+e.message+"\n"+e.stack);
	}
});
rl.on('SIGINT', async ()=>{
	console.log("Attempting graceful shutdown...");
	await server.destroy("Operator restarted server");
	rl.close();
	process.exit(0);
});

process.on('SIGINT', async ()=>{
	console.log("Attempting graceful shutdown...");
	await server.destroy("Operator restarted server");
	if(rl) rl.close();
	process.exit(0);
});

let config;
try {
	config = JSON.parse(await fs.readFile("./config.json"));
} catch {
	console.log("config.json not found, copying from config.json.example...");
	const example = await fs.readFile("./config.json.example");
	await fs.writeFile("./config.json", example);
	config = JSON.parse(example);
}
let server = new Server(config);