import 'dotenv/config';
import { ActionRowBuilder, ActivityType, ButtonBuilder, ButtonStyle, ChannelType, Client, EmbedBuilder, GatewayIntentBits, ModalBuilder, PermissionFlagsBits, REST, Routes, TextInputBuilder, TextInputStyle } from 'discord.js';
import { commands } from './commands.js';
import { addAudit, guildData, save, statsFor } from './store.js';
import { render } from './render.js';

const token = process.env.BOT_TOKEN;

if (!token) {
  throw new Error('BOT_TOKEN is missing. Set it in your .env file.');
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildEmojisAndStickers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.DirectMessages
  ]
});
const inviteSnapshots = new Map<string, Map<string, number>>();

client.once('ready', () => {
  console.log(`Logged in as ${client.user?.tag}`);
  client.user?.setPresence({
    activities: [{ name: 'TEHRAN CLUB BOT', type: ActivityType.Watching }],
    status: 'online'
  });
});

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isButton()) return handleButton(interaction);
    if (interaction.isModalSubmit()) return handleModal(interaction);
    if (!interaction.isChatInputCommand() || !interaction.guild) return;
    const guild = await guildData(interaction.guild.id);
    if (interaction.commandName === 'ping') await interaction.reply({ content: `Pong! ${client.ws.ping}ms`, ephemeral: true });
    else if (interaction.commandName === 'status') await interaction.reply({ content: `Online in ${client.guilds.cache.size} servers. Ping: ${client.ws.ping}ms`, ephemeral: true });
    else if (interaction.commandName === 'help') await interaction.reply({ content: 'Commands: /warn /warnings /clear /timeout /ticket /exchange /rank /balance /daily /pay /giveaway /config', ephemeral: true });
    else if (interaction.commandName === 'warn') await warn(interaction, guild);
    else if (interaction.commandName === 'warnings') await showWarnings(interaction, guild);
    else if (interaction.commandName === 'clear') await clearMessages(interaction);
    else if (interaction.commandName === 'timeout') await timeout(interaction, guild);
    else if (interaction.commandName === 'ticket') await createTicket(interaction, guild);
    else if (interaction.commandName === 'exchange') await createExchange(interaction, guild);
    else if (interaction.commandName === 'rank') await showRank(interaction, guild);
    else if (interaction.commandName === 'leaderboard') await leaderboard(interaction, guild);
    else if (interaction.commandName === 'invites') await invites(interaction, guild);
    else if (interaction.commandName === 'balance') await showBalance(interaction, guild);
    else if (interaction.commandName === 'daily') await daily(interaction, guild);
    else if (interaction.commandName === 'pay') await pay(interaction, guild);
    else if (interaction.commandName === 'giveaway') await createGiveaway(interaction, guild);
    else if (interaction.commandName === 'config') await interaction.reply({ content: `Language: ${guild.config.language}\nLog channel: ${guild.config.logChannelId ?? 'not configured'}\nWelcome channel: ${guild.config.welcomeChannelId ?? 'not configured'}\nTicket category: ${guild.config.ticketCategoryId ?? 'not configured'}`, ephemeral: true });
    addAudit(guild, `command.${interaction.commandName}`, interaction.user.id);
    await save();
  } catch (error) {
    console.error('Interaction failed:', error);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) await interaction.reply({ content: 'Something went wrong while processing that request.', ephemeral: true });
  }
});

const rest = new REST({ version: '10' }).setToken(token);

async function registerGuildCommands() {
  const guildId = process.env.GUILD_ID;
  if (!guildId) {
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID ?? ''), { body: commands });
    console.log('Global commands registered. Discord may take up to one hour to publish them.');
    return;
  }

  await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID ?? '', guildId), {
    body: commands
  });

  console.log('Guild commands registered.');
}

client.on('guildCreate', async (guild) => {
  console.log(`Joined guild: ${guild.name} (${guild.id})`);
});

client.on('guildMemberAdd', (member) => {
  void (async () => { const guild = await guildData(member.guild.id); const channel = guild.config.welcomeChannelId ? member.guild.channels.cache.get(guild.config.welcomeChannelId) : undefined; if (channel?.isTextBased()) await channel.send(render(guild.config.welcomeMessage, { user: `<@${member.id}>`, guild: member.guild.name })); addAudit(guild, 'member.join', undefined, member.id); await save(); })();
});

client.on('guildMemberRemove', (member) => {
  void (async () => { const guild = await guildData(member.guild.id); addAudit(guild, 'member.leave', undefined, member.id); await save(); })();
});

client.on('messageCreate', (message) => {
  if (!message.guild || message.author.bot) return;
  void (async () => {
    const guild = await guildData(message.guild!.id);
    const automodEnabled = guild.config.modules?.automod !== false;
    const inviteLink = /discord(?:\.gg|\.com\/invite)\/\S+/i.test(message.content);
    const excessiveMentions = message.mentions.users.size + message.mentions.roles.size > 5;
    if (automodEnabled && (inviteLink || excessiveMentions) && message.member?.moderatable) {
      await message.delete().catch(() => undefined);
      await message.member.timeout(60_000, 'AutoMod: invite link or excessive mentions').catch(() => undefined);
      addAudit(guild, 'automod.action', client.user?.id, message.author.id, { inviteLink, excessiveMentions });
      await save();
      return;
    }
    const stats = statsFor(guild, message.author.id);
    stats.messages += 1;
    stats.xp += 5;
    const nextLevel = Math.floor(Math.sqrt(stats.xp / 100));
    if (nextLevel > stats.level) { stats.level = nextLevel; await message.channel.send(`Congratulations ${message.author}, you reached level ${stats.level}!`); }
    await save();
  })();
});

async function warn(interaction: import('discord.js').ChatInputCommandInteraction, guild: Awaited<ReturnType<typeof guildData>>) { const user = interaction.options.getUser('user', true); const reason = interaction.options.getString('reason', true); const id = guild.warnings.length + 1; guild.warnings.push({ id, userId: user.id, moderatorId: interaction.user.id, reason, createdAt: new Date().toISOString() }); await interaction.reply(`Warning #${id} issued to ${user} for: ${reason}`); }
async function showWarnings(interaction: import('discord.js').ChatInputCommandInteraction, guild: Awaited<ReturnType<typeof guildData>>) { const user = interaction.options.getUser('user', true); const warnings = guild.warnings.filter(warning => warning.userId === user.id); await interaction.reply({ content: warnings.length ? warnings.map(w => `#${w.id} ${w.reason} (${w.createdAt.slice(0, 10)})`).join('\n') : `${user} has no warnings.`, ephemeral: true }); }
async function clearMessages(interaction: import('discord.js').ChatInputCommandInteraction) { if (!interaction.channel?.isTextBased() || !('bulkDelete' in interaction.channel)) return interaction.reply({ content: 'This command only works in a text channel.', ephemeral: true }); const amount = interaction.options.getInteger('amount', true); await interaction.deferReply({ ephemeral: true }); const deleted = await interaction.channel.bulkDelete(amount, true); await interaction.editReply(`Deleted ${deleted.size} messages.`); }
async function timeout(interaction: import('discord.js').ChatInputCommandInteraction, guild: Awaited<ReturnType<typeof guildData>>) { const user = interaction.options.getUser('user', true); const minutes = interaction.options.getInteger('minutes', true); const member = await interaction.guild!.members.fetch(user.id); if (!member.moderatable) return interaction.reply({ content: 'I cannot moderate that member due to role hierarchy.', ephemeral: true }); await member.timeout(minutes * 60_000, interaction.options.getString('reason') ?? 'No reason provided'); addAudit(guild, 'moderation.timeout', interaction.user.id, user.id, { minutes }); await interaction.reply(`${user} timed out for ${minutes} minutes.`); }
async function createTicket(interaction: import('discord.js').ChatInputCommandInteraction, guild: Awaited<ReturnType<typeof guildData>>) { const channel = await interaction.guild!.channels.create({ name: `ticket-${interaction.user.username}`.slice(0, 90), type: ChannelType.GuildText, parent: guild.config.ticketCategoryId, permissionOverwrites: [{ id: interaction.guild!.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] }, { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }] }); const id = guild.tickets.length + 1; guild.tickets.push({ id, guildId: interaction.guild!.id, channelId: channel.id, userId: interaction.user.id, status: 'open', createdAt: new Date().toISOString() }); const row = new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(`ticket:close:${id}`).setLabel('Close ticket').setStyle(ButtonStyle.Danger)); await channel.send({ content: `${interaction.user}, support staff will be with you shortly.`, components: [row] }); await interaction.reply({ content: `Ticket created: ${channel}`, ephemeral: true }); }
async function createExchange(interaction: import('discord.js').ChatInputCommandInteraction, guild: Awaited<ReturnType<typeof guildData>>) { const requestId = `EX-${Date.now().toString(36).toUpperCase()}`; const request = { id: requestId, guildId: interaction.guild!.id, userId: interaction.user.id, title: interaction.options.getString('title', true), description: interaction.options.getString('description', true), link: interaction.options.getString('link') ?? undefined, status: 'pending' as const, createdAt: new Date().toISOString() }; guild.exchanges.push(request); const channel = guild.config.exchangeChannelId ? interaction.guild!.channels.cache.get(guild.config.exchangeChannelId) : interaction.channel; if (channel?.isTextBased() && 'send' in channel) { const row = new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(`exchange:approve:${requestId}`).setLabel('Approve').setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId(`exchange:reject:${requestId}`).setLabel('Reject').setStyle(ButtonStyle.Danger)); await channel.send({ embeds: [new EmbedBuilder().setTitle(`Exchange ${requestId}`).setDescription(`${request.title}\n\n${request.description}`).setColor(0x5865f2).addFields({ name: 'Requester', value: `<@${request.userId}>` }, { name: 'Link', value: request.link ?? 'None' })], components: [row] }); } await interaction.reply({ content: `Exchange request ${requestId} submitted.`, ephemeral: true }); }
async function showRank(interaction: import('discord.js').ChatInputCommandInteraction, guild: Awaited<ReturnType<typeof guildData>>) { const user = interaction.options.getUser('user') ?? interaction.user; const stats = statsFor(guild, user.id); await interaction.reply(`${user} is level ${stats.level} with ${stats.xp} XP and ${stats.messages} messages.`); }
async function leaderboard(interaction: import('discord.js').ChatInputCommandInteraction, guild: Awaited<ReturnType<typeof guildData>>) { const rows = Object.entries(guild.stats).sort(([, left], [, right]) => right.xp - left.xp).slice(0, 10); await interaction.reply({ content: rows.length ? rows.map(([userId, stats], index) => `${index + 1}. <@${userId}> - level ${stats.level}, ${stats.xp} XP`).join('\n') : 'No XP data yet.', ephemeral: true }); }
async function invites(interaction: import('discord.js').ChatInputCommandInteraction, guild: Awaited<ReturnType<typeof guildData>>) { const user = interaction.options.getUser('user') ?? interaction.user; const stats = statsFor(guild, user.id); await interaction.reply({ content: `${user} has ${stats.invites} tracked invites.`, ephemeral: true }); }
async function showBalance(interaction: import('discord.js').ChatInputCommandInteraction, guild: Awaited<ReturnType<typeof guildData>>) { const user = interaction.options.getUser('user') ?? interaction.user; await interaction.reply({ content: `${user} has ${statsFor(guild, user.id).balance} coins.`, ephemeral: true }); }
async function daily(interaction: import('discord.js').ChatInputCommandInteraction, guild: Awaited<ReturnType<typeof guildData>>) { const stats = statsFor(guild, interaction.user.id); const today = new Date().toISOString().slice(0, 10); if (stats.lastDaily === today) return interaction.reply({ content: 'You already claimed today\'s reward.', ephemeral: true }); stats.lastDaily = today; stats.balance += 100; await interaction.reply(`Daily reward claimed. Your balance is now ${stats.balance} coins.`); }
async function pay(interaction: import('discord.js').ChatInputCommandInteraction, guild: Awaited<ReturnType<typeof guildData>>) { const recipient = interaction.options.getUser('user', true); const amount = interaction.options.getInteger('amount', true); const senderStats = statsFor(guild, interaction.user.id); if (senderStats.balance < amount) return interaction.reply({ content: 'Insufficient balance.', ephemeral: true }); senderStats.balance -= amount; statsFor(guild, recipient.id).balance += amount; await interaction.reply(`${interaction.user} paid ${amount} coins to ${recipient}.`); }
async function createGiveaway(interaction: import('discord.js').ChatInputCommandInteraction, guild: Awaited<ReturnType<typeof guildData>>) { const giveaway = { id: guild.giveaways.length + 1, guildId: interaction.guild!.id, channelId: interaction.channelId, prize: interaction.options.getString('prize', true), winners: interaction.options.getInteger('winners', true), endsAt: new Date(Date.now() + interaction.options.getInteger('minutes', true) * 60_000).toISOString(), entries: [] as string[], ended: false, messageId: undefined as string | undefined }; guild.giveaways.push(giveaway); const row = new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(`giveaway:enter:${giveaway.id}`).setLabel('Enter giveaway').setStyle(ButtonStyle.Primary)); if (!interaction.channel?.isTextBased() || !('send' in interaction.channel)) return interaction.reply({ content: 'Giveaways require a text channel.', ephemeral: true }); const message = await interaction.channel.send({ embeds: [new EmbedBuilder().setTitle(`Giveaway #${giveaway.id}`).setDescription(`Prize: **${giveaway.prize}**\nEnds: <t:${Math.floor(new Date(giveaway.endsAt).getTime() / 1000)}:R>`).setColor(0xf1c40f)], components: [row] }); giveaway.messageId = message.id; await interaction.reply({ content: `Giveaway #${giveaway.id} created.`, ephemeral: true }); }

async function handleButton(interaction: import('discord.js').ButtonInteraction) { if (!interaction.guild) return; const [type, action, rawId] = interaction.customId.split(':'); const guild = await guildData(interaction.guild.id); if (type === 'ticket' && action === 'close') { const ticket = guild.tickets.find(item => item.id === Number(rawId)); if (!ticket) return interaction.reply({ content: 'Ticket not found.', ephemeral: true }); ticket.status = 'closed'; ticket.closedAt = new Date().toISOString(); if (interaction.channel && 'send' in interaction.channel) await interaction.channel.send('Ticket closed.'); if (interaction.channel && 'edit' in interaction.channel && 'name' in interaction.channel) await interaction.channel.edit({ name: `closed-${interaction.channel.name}` }); await interaction.reply({ content: 'Ticket closed.', ephemeral: true }); } else if (type === 'exchange' && (action === 'approve' || action === 'reject')) { const request = guild.exchanges.find(item => item.id === rawId); if (!request) return interaction.reply({ content: 'Request not found.', ephemeral: true }); if (!interaction.member || typeof interaction.member.permissions === 'string' || !interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) return interaction.reply({ content: 'You need Manage Server to review exchanges.', ephemeral: true }); if (action === 'reject') { const modal = new ModalBuilder().setCustomId(`exchange-reject:${rawId}`).setTitle('Reject exchange').addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('reason').setLabel('Reason').setStyle(TextInputStyle.Paragraph).setRequired(true))); return interaction.showModal(modal); } request.status = 'approved'; request.reviewedBy = interaction.user.id; await interaction.update({ content: `Exchange ${rawId} approved by ${interaction.user}.`, embeds: [], components: [] }); } else if (type === 'giveaway' && action === 'enter') { const giveaway = guild.giveaways.find(item => item.id === Number(rawId)); if (!giveaway || giveaway.ended || new Date(giveaway.endsAt) <= new Date()) return interaction.reply({ content: 'This giveaway has ended.', ephemeral: true }); if (giveaway.entries.includes(interaction.user.id)) return interaction.reply({ content: 'You are already entered.', ephemeral: true }); giveaway.entries.push(interaction.user.id); await interaction.reply({ content: 'You entered the giveaway!', ephemeral: true }); } await save(); }
async function handleModal(interaction: import('discord.js').ModalSubmitInteraction) { if (!interaction.guild || !interaction.customId.startsWith('exchange-reject:')) return; const request = (await guildData(interaction.guild.id)).exchanges.find(item => item.id === interaction.customId.split(':')[1]); if (!request) return interaction.reply({ content: 'Request not found.', ephemeral: true }); request.status = 'rejected'; request.reason = interaction.fields.getTextInputValue('reason'); request.reviewedBy = interaction.user.id; await interaction.reply({ content: `Exchange ${request.id} rejected.`, ephemeral: true }); await save(); }

async function bootstrap() {
  await registerGuildCommands();
  await client.login(token);
}

bootstrap().catch((error) => {
  console.error('Bot failed to start:', error);
  process.exit(1);
});
