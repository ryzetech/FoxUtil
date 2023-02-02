const fs = require('node:fs');
const path = require('node:path');
const { Client, Events, GatewayIntentBits, Collection } = require('discord.js');
const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildPresences,
		GatewayIntentBits.GuildMembers,
	],
});
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
client.prisma = prisma;
const { token } = require('./token.json');
// const config = require('./config.json');

client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
	const filePath = path.join(commandsPath, file);
	const command = require(filePath);
	if ('data' in command && 'execute' in command) {
		client.commands.set(command.data.name, command);
	}
	else {
		console.warn(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
	}
}

client.once(Events.ClientReady, c => {
	console.log('Client ready! Logged in as ' + c.user.tag);
});

client.on(Events.GuildMemberRemove, async member => {
	const rolearray = [];
	member.roles.cache.forEach(async role => {
		const r = await prisma.role.upsert({
			where: {
				id: role.id,
			},
			create: {
				id: role.id,
				name: role.name,
			},
		});
		rolearray.push(r);
	});

	// eslint-disable-next-line no-unused-vars
	const user = await prisma.user.upsert({
		where: {
			id: member.id,
		},
		create: {
			id: member.id,
			name: member.displayName,
			roles: {
				connect: rolearray,
			},
		},
		update: {
			name: member.displayName,
			roles: {
				connect: rolearray,
			},
		},
	});
});

client.on(Events.GuildMemberAdd, async member => {
	const user = await prisma.user.findUnique({
		where: {
			id: member.id,
		},
		include: {
			roles: true,
		},
	});

	if (!user) return console.warn(`[WARNING] User ${member.displayName} (${member.id}) not found in database.`);

	const roles = user.roles.map(role => role.id);
	member.roles.add(roles);
});


client.login(token);