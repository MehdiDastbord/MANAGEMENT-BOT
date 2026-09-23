import "dotenv/config";
import {
  ActionRowBuilder,
  ActivityType,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  ModalBuilder,
  PermissionFlagsBits,
  REST,
  Routes,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { commands } from "./commands.js";
import { addAudit, guildData, save, statsFor } from "./store.js";
import { render } from "./render.js";
import { hasPermission, type PermissionAction } from "./permissions.js";

const token = process.env.BOT_TOKEN;

if (!token) {
  throw new Error("BOT_TOKEN is missing. Set it in your .env file.");
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
    GatewayIntentBits.DirectMessages,
  ],
});
const inviteSnapshots = new Map<string, Map<string, number>>();

const logCategoryFor = (action: string): string => action.split('.')[0];

async function logEvent(guild: Awaited<ReturnType<typeof guildData>>, guildId: string, action: string, actorId?: string, targetId?: string, metadata?: unknown): Promise<void> {
  addAudit(guild, action, actorId, targetId, metadata);
  const channelId = guild.config.logChannels?.[logCategoryFor(action)] ?? guild.config.logChannels?.[action] ?? guild.config.logChannelId;
  if (!channelId) return;
  const channel = client.channels.cache.get(channelId);
  if (!channel?.isTextBased() || !('send' in channel)) return;
  const details = metadata && typeof metadata === 'object' ? Object.entries(metadata as Record<string, unknown>).map(([key, value]) => `${key}: ${String(value)}`).join('\n').slice(0, 900) : undefined;
  await channel.send({ embeds: [new EmbedBuilder().setTitle(action).setColor(0x5865f2).addFields(
    { name: 'Actor', value: actorId ? `<@${actorId}>` : 'Discord event' },
    { name: 'Target', value: targetId ? `<@${targetId}>` : 'None' },
    ...(details ? [{ name: 'Details', value: details }] : [])
  ).setTimestamp()] }).catch(() => undefined);
}

client.once("ready", () => {
  console.log(`Logged in as ${client.user?.tag}`);
  client.user?.setPresence({
    activities: [{ name: "TEHRAN CLUB BOT", type: ActivityType.Watching }],
    status: "online",
  });
});

client.on("interactionCreate", async (interaction) => {
  try {
    if (interaction.isButton()) {
      await handleButton(interaction);
      return;
    }
    if (interaction.isStringSelectMenu()) {
      await handleSelectMenu(interaction);
      return;
    }
    if (interaction.isModalSubmit()) {
      await handleModal(interaction);
      return;
    }
    if (!interaction.isChatInputCommand() || !interaction.guild) return;
    const guild = await guildData(interaction.guild.id);
    if (interaction.commandName === "ping")
      await interaction.reply({
        content: `Pong! ${client.ws.ping}ms`,
        ephemeral: true,
      });
    else if (interaction.commandName === "status")
      await interaction.reply({
        content: `Online in ${client.guilds.cache.size} servers. Ping: ${client.ws.ping}ms`,
        ephemeral: true,
      });
    else if (interaction.commandName === "help")
      await interaction.reply({
        content:
          "Commands: /warn /warnings /clear /timeout /ticket /exchange /rank /balance /daily /pay /giveaway /config",
        ephemeral: true,
      });
    else if (interaction.commandName === "warn") await warn(interaction, guild);
    else if (interaction.commandName === "ban") await ban(interaction, guild);
    else if (interaction.commandName === "unban") await unban(interaction, guild);
    else if (interaction.commandName === "kick") await kick(interaction, guild);
    else if (interaction.commandName === "untimeout") await untimeout(interaction, guild);
    else if (interaction.commandName === "unwarn") await unwarn(interaction, guild);
    else if (interaction.commandName === "lock") await lockChannel(interaction, guild, true);
    else if (interaction.commandName === "unlock") await lockChannel(interaction, guild, false);
    else if (interaction.commandName === "slowmode") await slowmode(interaction, guild);
    else if (interaction.commandName === "warnings")
      await showWarnings(interaction, guild);
    else if (interaction.commandName === "clear")
      await clearMessages(interaction);
    else if (interaction.commandName === "timeout")
      await timeout(interaction, guild);
    else if (interaction.commandName === "ticket")
      await createTicket(interaction, guild);
    else if (interaction.commandName === "panel")
      await openPanelMenu(interaction, guild);
    else if (interaction.commandName === "exchange")
      await createExchange(interaction, guild);
    else if (interaction.commandName === "rank")
      await showRank(interaction, guild);
    else if (interaction.commandName === "level")
      await showRank(interaction, guild);
    else if (interaction.commandName === "leaderboard")
      await leaderboard(interaction, guild);
    else if (interaction.commandName === "invites")
      await invites(interaction, guild);
    else if (interaction.commandName === "invite-leaderboard")
      await inviteLeaderboard(interaction, guild);
    else if (interaction.commandName === "rep") await rep(interaction, guild);
    else if (interaction.commandName === "poll") await poll(interaction, guild);
    else if (interaction.commandName === "pollvote")
      await pollvote(interaction, guild);
    else if (interaction.commandName === "announce")
      await announce(interaction);
    else if (interaction.commandName === "balance")
      await showBalance(interaction, guild);
    else if (interaction.commandName === "daily")
      await daily(interaction, guild);
    else if (interaction.commandName === "pay") await pay(interaction, guild);
    else if (interaction.commandName === "giveaway")
      await createGiveaway(interaction, guild);
    else if (interaction.commandName === "drop")
      await createDrop(interaction, guild);
    else if (interaction.commandName === "setup")
      await setup(interaction, guild);
    else if (interaction.commandName === "config")
      await interaction.reply({
        content: `Language: ${guild.config.language}\nLog channel: ${guild.config.logChannelId ?? "not configured"}\nWelcome channel: ${guild.config.welcomeChannelId ?? "not configured"}\nTicket category: ${guild.config.ticketCategoryId ?? "not configured"}`,
        ephemeral: true,
      });
    await logEvent(guild, interaction.guild.id, `command.${interaction.commandName}`, interaction.user.id);
    await save();
  } catch (error) {
    console.error("Interaction failed:", error);
    if (
      interaction.isRepliable() &&
      !interaction.replied &&
      !interaction.deferred
    )
      await interaction.reply({
        content: "Something went wrong while processing that request.",
        ephemeral: true,
      });
  }
});

const rest = new REST({ version: "10" }).setToken(token);

async function registerGuildCommands() {
  const guildId = process.env.GUILD_ID;
  if (!guildId) {
    try {
      await rest.put(Routes.applicationCommands(process.env.CLIENT_ID ?? ""), {
        body: commands,
      });
      console.log(
        "Global commands registered. Discord may take up to one hour to publish them.",
      );
    } catch (error) {
      console.warn(
        "Global command registration failed. Check CLIENT_ID and BOT_TOKEN.",
        error,
      );
    }
    return;
  }

  try {
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID ?? "", guildId),
      { body: commands },
    );
    console.log("Guild commands registered.");
  } catch (error) {
    console.warn(
      "Guild command registration failed. Check that the bot is invited to GUILD_ID with applications.commands scope.",
      error,
    );
  }
}

client.on("guildCreate", async (guild) => {
  console.log(`Joined guild: ${guild.name} (${guild.id})`);
});

client.on("guildMemberAdd", (member) => {
  void (async () => {
    const guild = await guildData(member.guild.id);
    const channel = guild.config.welcomeChannelId
      ? member.guild.channels.cache.get(guild.config.welcomeChannelId)
      : undefined;
    if (channel?.isTextBased())
      await channel.send(
        render(guild.config.welcomeMessage, {
          user: `<@${member.id}>`,
          guild: member.guild.name,
        }),
      );
    await logEvent(guild, member.guild.id, "member.join", undefined, member.id);
    await save();
  })();
});

client.on("guildMemberRemove", (member) => {
  void (async () => {
    const guild = await guildData(member.guild.id);
    const channel = guild.config.leaveChannelId
      ? member.guild.channels.cache.get(guild.config.leaveChannelId)
      : undefined;
    if (channel?.isTextBased() && guild.config.modules?.welcome !== false)
      await channel.send(render(guild.config.leaveMessage ?? "Goodbye {{user}}.", { user: member.user.username, guild: member.guild.name }));
    await logEvent(guild, member.guild.id, "member.leave", undefined, member.id);
    await save();
  })();
});

client.on("guildBanAdd", (ban) => {
  void (async () => {
    const guild = await guildData(ban.guild.id);
    await logEvent(guild, ban.guild.id, "member.ban", undefined, ban.user.id, { reason: ban.reason ?? "Unknown" });
    await save();
  })();
});

client.on("guildBanRemove", (ban) => {
  void (async () => {
    const guild = await guildData(ban.guild.id);
    await logEvent(guild, ban.guild.id, "member.unban", undefined, ban.user.id);
    await save();
  })();
});

client.on("roleCreate", (role) => {
  void (async () => { const guild = await guildData(role.guild.id); await logEvent(guild, role.guild.id, "role.create", undefined, role.id, { name: role.name }); await save(); })();
});
client.on("roleDelete", (role) => {
  void (async () => { const guild = await guildData(role.guild.id); await logEvent(guild, role.guild.id, "role.delete", undefined, role.id, { name: role.name }); await save(); })();
});
client.on("roleUpdate", (oldRole, newRole) => {
  void (async () => { const guild = await guildData(newRole.guild.id); await logEvent(guild, newRole.guild.id, "role.update", undefined, newRole.id, { before: oldRole.name, after: newRole.name, color: newRole.hexColor }); await save(); })();
});
client.on("channelCreate", (channel) => {
  if (!channel.guild) return;
  void (async () => { const guild = await guildData(channel.guild!.id); await logEvent(guild, channel.guild!.id, "channel.create", undefined, channel.id, { name: channel.name }); await save(); })();
});
client.on("channelDelete", (channel) => {
  if (!("guild" in channel)) return;
  void (async () => { const guild = await guildData(channel.guild.id); await logEvent(guild, channel.guild.id, "channel.delete", undefined, channel.id, { name: channel.name }); await save(); })();
});
client.on("channelUpdate", (oldChannel, newChannel) => {
  if (!("guild" in newChannel) || !("name" in oldChannel)) return;
  void (async () => { const guild = await guildData(newChannel.guild.id); await logEvent(guild, newChannel.guild.id, "channel.update", undefined, newChannel.id, { before: oldChannel.name, after: newChannel.name }); await save(); })();
});
client.on("messageUpdate", (oldMessage, newMessage) => {
  if (!newMessage.guild || newMessage.author?.bot) return;
  void (async () => { const guild = await guildData(newMessage.guild!.id); await logEvent(guild, newMessage.guild!.id, "message.edit", newMessage.author?.id, newMessage.id, { channelId: newMessage.channelId }); await save(); })();
});
client.on("messageDelete", (message) => {
  if (!message.guild || message.author?.bot) return;
  void (async () => { const guild = await guildData(message.guild!.id); await logEvent(guild, message.guild!.id, "message.delete", message.author?.id, message.id, { channelId: message.channelId }); await save(); })();
});
client.on("voiceStateUpdate", (oldState, newState) => {
  const guildId = newState.guild.id;
  void (async () => { const guild = await guildData(guildId); await logEvent(guild, guildId, "voice.update", newState.member?.id, newState.member?.id, { before: oldState.channelId ?? "none", after: newState.channelId ?? "none" }); await save(); })();
});

client.on("messageCreate", (message) => {
  if (!message.guild || message.author.bot) return;
  void (async () => {
    const messageGuild = message.guild!;
    const guild = await guildData(messageGuild.id);
    const automod = guild.config.automod;
    const automodEnabled = guild.config.modules?.automod !== false && automod?.enabled !== false;
    const ignored = automod?.ignoredUsers.includes(message.author.id) || automod?.ignoredChannels.includes(message.channelId) || (message.member?.roles.cache.some(role => automod?.ignoredRoles.includes(role.id)) ?? false);
    const inviteLink = /discord(?:\.gg|\.com\/invite)\/\S+/i.test(
      message.content,
    );
    const excessiveMentions =
      message.mentions.users.size + message.mentions.roles.size > 5;
    const capsSpam = message.content.length >= 12 && message.content === message.content.toUpperCase() && message.content !== message.content.toLowerCase();
    const badWord = automod?.badWords.some(word => message.content.toLowerCase().includes(word.toLowerCase())) ?? false;
    if (
      automodEnabled && !ignored &&
      ((automod?.inviteLinks !== false && inviteLink) || (automod?.mentionSpam !== false && excessiveMentions) || (automod?.capsSpam && capsSpam) || badWord) &&
      message.member?.moderatable
    ) {
      await message.delete().catch(() => undefined);
      if (automod?.action !== 'delete') await message.member.timeout((automod?.timeoutSeconds ?? 60) * 1000, "AutoMod policy violation").catch(() => undefined);
      await logEvent(guild, messageGuild.id, "automod.action", client.user?.id, message.author.id, {
        inviteLink, excessiveMentions, capsSpam, badWord, action: automod?.action ?? 'timeout'
      });
      await save();
      return;
    }
    const stats = statsFor(guild, message.author.id);
    stats.messages += 1;
    stats.xp += 5;
    const nextLevel = Math.floor(Math.sqrt(stats.xp / 100));
    if (nextLevel > stats.level) {
      stats.level = nextLevel;
      const levelChannel = guild.config.levelChannelId ? messageGuild.channels.cache.get(guild.config.levelChannelId) : message.channel;
      if (levelChannel?.isTextBased() && 'send' in levelChannel) await levelChannel.send(
        `Congratulations ${message.author}, you reached level ${stats.level}!`,
      );
    }
    await save();
  })();
});

async function warn(
  interaction: import("discord.js").ChatInputCommandInteraction,
  guild: Awaited<ReturnType<typeof guildData>>,
) {
  if (!canUse(interaction, "moderation.warn", guild)) return interaction.reply({ content: "You do not have permission to warn members.", ephemeral: true });
  const user = interaction.options.getUser("user", true);
  const reason = interaction.options.getString("reason", true);
  const id = guild.warnings.length + 1;
  guild.warnings.push({
    id,
    userId: user.id,
    moderatorId: interaction.user.id,
    reason,
    createdAt: new Date().toISOString(),
  });
  await interaction.reply(`Warning #${id} issued to ${user} for: ${reason}`);
}
function canUse(interaction: import("discord.js").ChatInputCommandInteraction, action: PermissionAction, guild: Awaited<ReturnType<typeof guildData>>): boolean {
  if (!interaction.member || typeof interaction.member.permissions === "string") return false;
  if (interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  const permissions = interaction.member.permissions;
  const requiredDiscordPermission = action === "moderation.ban" ? PermissionFlagsBits.BanMembers : action === "moderation.kick" ? PermissionFlagsBits.KickMembers : action === "channels.manage" ? PermissionFlagsBits.ManageChannels : PermissionFlagsBits.ModerateMembers;
  if (!permissions.has(requiredDiscordPermission)) return false;
  if ("roles" in interaction.member && !Array.isArray(interaction.member.roles)) {
    const roleMap = guild.config.rolePermissions ?? {};
    const roleIds = interaction.member.roles.cache.map(role => role.id);
    if (Object.keys(roleMap).length === 0) return true;
    return roleIds.some(roleId => roleMap[roleId]?.includes(action));
  }
  return true;
}
async function ban(interaction: import("discord.js").ChatInputCommandInteraction, guild: Awaited<ReturnType<typeof guildData>>) {
  if (!canUse(interaction, "moderation.ban", guild)) return interaction.reply({ content: "You do not have permission to ban members.", ephemeral: true });
  const user = interaction.options.getUser("user", true);
  const reason = interaction.options.getString("reason") ?? "No reason provided";
  await interaction.guild!.members.ban(user, { reason });
  await logEvent(guild, interaction.guild!.id, "moderation.ban", interaction.user.id, user.id, { reason });
  await interaction.reply(`${user.tag} was banned.`);
}
async function unban(interaction: import("discord.js").ChatInputCommandInteraction, guild: Awaited<ReturnType<typeof guildData>>) {
  if (!canUse(interaction, "moderation.ban", guild)) return interaction.reply({ content: "You do not have permission to unban members.", ephemeral: true });
  const userId = interaction.options.getString("user_id", true);
  const reason = interaction.options.getString("reason") ?? "No reason provided";
  await interaction.guild!.members.unban(userId, reason);
  await logEvent(guild, interaction.guild!.id, "moderation.unban", interaction.user.id, userId, { reason });
  await interaction.reply(`User ${userId} was unbanned.`);
}
async function kick(interaction: import("discord.js").ChatInputCommandInteraction, guild: Awaited<ReturnType<typeof guildData>>) {
  if (!canUse(interaction, "moderation.kick", guild)) return interaction.reply({ content: "You do not have permission to kick members.", ephemeral: true });
  const user = interaction.options.getUser("user", true);
  const member = await interaction.guild!.members.fetch(user.id);
  if (!member.kickable) return interaction.reply({ content: "I cannot kick that member because of role hierarchy.", ephemeral: true });
  const reason = interaction.options.getString("reason") ?? "No reason provided";
  await member.kick(reason);
  await logEvent(guild, interaction.guild!.id, "moderation.kick", interaction.user.id, user.id, { reason });
  await interaction.reply(`${user.tag} was kicked.`);
}
async function untimeout(interaction: import("discord.js").ChatInputCommandInteraction, guild: Awaited<ReturnType<typeof guildData>>) {
  if (!canUse(interaction, "moderation.timeout", guild)) return interaction.reply({ content: "You do not have permission to remove timeouts.", ephemeral: true });
  const user = interaction.options.getUser("user", true);
  const member = await interaction.guild!.members.fetch(user.id);
  if (!member.moderatable) return interaction.reply({ content: "I cannot modify that member because of role hierarchy.", ephemeral: true });
  await member.timeout(null, "Timeout removed");
  await logEvent(guild, interaction.guild!.id, "moderation.untimeout", interaction.user.id, user.id);
  await interaction.reply(`Timeout removed for ${user.tag}.`);
}
async function unwarn(interaction: import("discord.js").ChatInputCommandInteraction, guild: Awaited<ReturnType<typeof guildData>>) {
  if (!canUse(interaction, "moderation.warn", guild)) return interaction.reply({ content: "You do not have permission to remove warnings.", ephemeral: true });
  const id = interaction.options.getInteger("case", true);
  const index = guild.warnings.findIndex(warning => warning.id === id);
  if (index < 0) return interaction.reply({ content: "Warning not found.", ephemeral: true });
  const [warning] = guild.warnings.splice(index, 1);
  await logEvent(guild, interaction.guild!.id, "moderation.unwarn", interaction.user.id, warning.userId, { warningId: id });
  await interaction.reply(`Warning #${id} removed.`);
}
async function lockChannel(interaction: import("discord.js").ChatInputCommandInteraction, guild: Awaited<ReturnType<typeof guildData>>, locked: boolean) {
  if (!canUse(interaction, "channels.manage", guild)) return interaction.reply({ content: "You do not have permission to manage channels.", ephemeral: true });
  if (!interaction.channel || !interaction.guild || !("permissionOverwrites" in interaction.channel)) return interaction.reply({ content: "This command requires a guild channel.", ephemeral: true });
  await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: locked ? false : null });
  await logEvent(guild, interaction.guild!.id, locked ? "channel.lock" : "channel.unlock", interaction.user.id, interaction.channelId);
  await interaction.reply({ content: locked ? "Channel locked." : "Channel unlocked.", ephemeral: true });
}
async function slowmode(interaction: import("discord.js").ChatInputCommandInteraction, guild: Awaited<ReturnType<typeof guildData>>) {
  if (!canUse(interaction, "channels.manage", guild)) return interaction.reply({ content: "You do not have permission to manage channels.", ephemeral: true });
  if (!interaction.channel || !interaction.channel.isTextBased() || !("setRateLimitPerUser" in interaction.channel)) return interaction.reply({ content: "This command requires a text channel.", ephemeral: true });
  const seconds = interaction.options.getInteger("seconds", true);
  await interaction.channel.setRateLimitPerUser(seconds);
  await logEvent(guild, interaction.guild!.id, "channel.slowmode", interaction.user.id, interaction.channelId, { seconds });
  await interaction.reply({ content: `Slowmode set to ${seconds} seconds.`, ephemeral: true });
}
async function showWarnings(
  interaction: import("discord.js").ChatInputCommandInteraction,
  guild: Awaited<ReturnType<typeof guildData>>,
) {
  const user = interaction.options.getUser("user", true);
  const warnings = guild.warnings.filter(
    (warning) => warning.userId === user.id,
  );
  await interaction.reply({
    content: warnings.length
      ? warnings
          .map((w) => `#${w.id} ${w.reason} (${w.createdAt.slice(0, 10)})`)
          .join("\n")
      : `${user} has no warnings.`,
    ephemeral: true,
  });
}
async function clearMessages(
  interaction: import("discord.js").ChatInputCommandInteraction,
) {
  const guild = await guildData(interaction.guild?.id ?? "");
  if (!canUse(interaction, "moderation.manage", guild)) return interaction.reply({ content: "You do not have permission to delete messages.", ephemeral: true });
  if (
    !interaction.channel?.isTextBased() ||
    !("bulkDelete" in interaction.channel)
  )
    return interaction.reply({
      content: "This command only works in a text channel.",
      ephemeral: true,
    });
  const amount = interaction.options.getInteger("amount", true);
  await interaction.deferReply({ ephemeral: true });
  const deleted = await interaction.channel.bulkDelete(amount, true);
  await interaction.editReply(`Deleted ${deleted.size} messages.`);
}
async function timeout(
  interaction: import("discord.js").ChatInputCommandInteraction,
  guild: Awaited<ReturnType<typeof guildData>>,
) {
  if (!canUse(interaction, "moderation.timeout", guild)) return interaction.reply({ content: "You do not have permission to timeout members.", ephemeral: true });
  const user = interaction.options.getUser("user", true);
  const minutes = interaction.options.getInteger("minutes", true);
  const member = await interaction.guild!.members.fetch(user.id);
  if (!member.moderatable)
    return interaction.reply({
      content: "I cannot moderate that member due to role hierarchy.",
      ephemeral: true,
    });
  await member.timeout(
    minutes * 60_000,
    interaction.options.getString("reason") ?? "No reason provided",
  );
  await logEvent(guild, interaction.guild!.id, "moderation.timeout", interaction.user.id, user.id, {
    minutes,
  });
  await interaction.reply(`${user} timed out for ${minutes} minutes.`);
}
async function createTicket(
  interaction: import("discord.js").ChatInputCommandInteraction,
  guild: Awaited<ReturnType<typeof guildData>>,
) {
  const existing = guild.tickets.find(
    (ticket) =>
      ticket.userId === interaction.user.id && ticket.status !== "closed",
  );
  if (existing)
    return interaction.reply({
      content: `You already have an open ticket: <#${existing.channelId}>`,
      ephemeral: true,
    });
  const permissionOverwrites = [
    {
      id: interaction.guild!.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    {
      id: interaction.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    },
  ];
  const staffRoleId = guild.config.ticketStaffRoleId ?? guild.config.staffRoleId;
  if (staffRoleId)
    permissionOverwrites.push({
      id: staffRoleId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    });
  const channel = await interaction.guild!.channels.create({
    name: (guild.config.ticketNameTemplate ?? "ticket-{{username}}")
      .replaceAll("{{username}}", interaction.user.username)
      .replaceAll("{{user_id}}", interaction.user.id)
      .replace(/[^a-zA-Z0-9-]/g, "-")
      .slice(0, 90),
    type: ChannelType.GuildText,
    parent: guild.config.ticketCategoryId,
    permissionOverwrites,
  });
  const id = guild.tickets.length + 1;
  guild.tickets.push({
    id,
    guildId: interaction.guild!.id,
    channelId: channel.id,
    userId: interaction.user.id,
    status: "open",
    createdAt: new Date().toISOString(),
  });
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`ticket:claim:${id}`)
      .setLabel("Claim")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`ticket:close:${id}`)
      .setLabel("Close")
      .setStyle(ButtonStyle.Danger),
  );
  await channel.send({
    content: `${guild.config.ticketMentionRoleId ? `<@&${guild.config.ticketMentionRoleId}> ` : ""}${interaction.user}, support staff will be with you shortly.`,
    components: [row],
  allowedMentions: guild.config.ticketMentionRoleId ? { roles: [guild.config.ticketMentionRoleId], users: [interaction.user.id] } : { users: [interaction.user.id] },
  });
  await logEvent(guild, interaction.guild!.id, "ticket.created", interaction.user.id, String(id), { channelId: channel.id });
  await interaction.reply({
    content: `Ticket created: ${channel}`,
    ephemeral: true,
  });
}

async function createTranscript(
  interaction: import("discord.js").ButtonInteraction,
  guild: Awaited<ReturnType<typeof guildData>>,
  ticket: Awaited<ReturnType<typeof guildData>>["tickets"][number],
) {
  if (!interaction.channel || !("messages" in interaction.channel)) return;
  const allMessages = new Map<string, import("discord.js").Message>();
  let before: string | undefined;
  while (true) {
    const page = await interaction.channel.messages.fetch({ limit: 100, before });
    for (const message of page.values()) allMessages.set(message.id, message);
    if (page.size < 100) break;
    before = page.last()?.id;
    if (!before) break;
  }
  const content = [...allMessages.values()]
    .sort((left, right) => left.createdTimestamp - right.createdTimestamp)
    .map((message) => `[${new Date(message.createdTimestamp).toISOString()}] ${message.author.tag}: ${message.cleanContent || "[attachment/embed]"}`)
    .join("\n");
  guild.transcripts ??= [];
  guild.transcripts.push({ id: crypto.randomUUID(), ticketId: ticket.id, channelId: ticket.channelId, content, createdAt: new Date().toISOString() });
  const transcriptChannelId = guild.config.ticketTranscriptChannelId ?? guild.config.logChannelId;
  if (transcriptChannelId) {
    const logChannel = interaction.guild?.channels.cache.get(transcriptChannelId);
    if (logChannel?.isTextBased() && "send" in logChannel) {
      await logChannel.send({ content: `Transcript for ticket #${ticket.id}`, files: [{ attachment: Buffer.from(content || "No messages", "utf8"), name: `ticket-${ticket.id}-transcript.txt` }] });
    }
  }
  await logEvent(guild, interaction.guild!.id, "ticket.transcript", interaction.user.id, String(ticket.id), { channelId: ticket.channelId });
}
async function createExchange(
  interaction: import("discord.js").ChatInputCommandInteraction,
  guild: Awaited<ReturnType<typeof guildData>>,
) {
  const requestId = `EX-${Date.now().toString(36).toUpperCase()}`;
  const banner = interaction.options.getAttachment("banner", true);
  if (!banner.contentType?.startsWith("image/")) return interaction.reply({ content: "The banner must be an image upload.", ephemeral: true });
  const description = sanitizeExchangeText(interaction.options.getString("description", true));
  const request = {
    id: requestId,
    guildId: interaction.guild!.id,
    userId: interaction.user.id,
    title: interaction.options.getString("title", true),
    description,
    link: sanitizeExchangeText(interaction.options.getString("link") ?? "") || undefined,
    bannerUrl: banner.url,
    status: "pending" as const,
    createdAt: new Date().toISOString(),
  };
  guild.exchanges.push(request);
  const channel = (guild.config.exchangeReviewChannelId ?? guild.config.exchangeChannelId)
    ? interaction.guild!.channels.cache.get(guild.config.exchangeReviewChannelId ?? guild.config.exchangeChannelId!)
    : interaction.channel;
  if (channel?.isTextBased() && "send" in channel) {
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`exchange:approve:${requestId}`)
        .setLabel("Approve")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`exchange:reject:${requestId}`)
        .setLabel("Reject")
        .setStyle(ButtonStyle.Danger),
    );
    await channel.send({
      content: guild.config.exchangeReviewRoleId ? `<@&${guild.config.exchangeReviewRoleId}>` : undefined,
      embeds: [
        new EmbedBuilder()
          .setTitle(`Exchange ${requestId}`)
          .setDescription(`${request.title}\n\n${request.description}`)
          .setColor(0x5865f2)
          .addFields(
            { name: "Requester", value: `<@${request.userId}>` },
            { name: "Link", value: request.link ?? "None" },
          )
          .setImage(request.bannerUrl),
      ],
      components: [row],
      allowedMentions: { roles: guild.config.exchangeReviewRoleId ? [guild.config.exchangeReviewRoleId] : [], users: [request.userId] },
    });
  }
  await logEvent(guild, interaction.guild!.id, "exchange.submitted", interaction.user.id, requestId, { bannerUrl: request.bannerUrl });
  await interaction.reply({
    content: `Exchange request ${requestId} submitted.`,
    ephemeral: true,
  });
}
function sanitizeExchangeText(value: string): string {
  return value.replace(/@(everyone|here)/gi, "[$1]").replace(/<@&?\d+>/g, "[mention]");
}
async function showRank(
  interaction: import("discord.js").ChatInputCommandInteraction,
  guild: Awaited<ReturnType<typeof guildData>>,
) {
  const user = interaction.options.getUser("user") ?? interaction.user;
  const stats = statsFor(guild, user.id);
  await interaction.reply(
    `${user} is level ${stats.level} with ${stats.xp} XP and ${stats.messages} messages.`,
  );
}
async function leaderboard(
  interaction: import("discord.js").ChatInputCommandInteraction,
  guild: Awaited<ReturnType<typeof guildData>>,
) {
  const rows = Object.entries(guild.stats)
    .sort(([, left], [, right]) => right.xp - left.xp)
    .slice(0, 10);
  await interaction.reply({
    content: rows.length
      ? rows
          .map(
            ([userId, stats], index) =>
              `${index + 1}. <@${userId}> - level ${stats.level}, ${stats.xp} XP`,
          )
          .join("\n")
      : "No XP data yet.",
    ephemeral: true,
  });
}
async function invites(
  interaction: import("discord.js").ChatInputCommandInteraction,
  guild: Awaited<ReturnType<typeof guildData>>,
) {
  const user = interaction.options.getUser("user") ?? interaction.user;
  const stats = statsFor(guild, user.id);
  await interaction.reply({
    content: `${user} has ${stats.invites} tracked invites.`,
    ephemeral: true,
  });
}
async function inviteLeaderboard(
  interaction: import("discord.js").ChatInputCommandInteraction,
  guild: Awaited<ReturnType<typeof guildData>>,
) {
  const rows = Object.entries(guild.stats).sort(([, left], [, right]) => right.invites - left.invites).slice(0, 10);
  await interaction.reply({ content: rows.length ? rows.map(([userId, stats], index) => `${index + 1}. <@${userId}> - ${stats.invites} invites`).join("\n") : "No invite data yet.", ephemeral: true });
}
async function rep(
  interaction: import("discord.js").ChatInputCommandInteraction,
  guild: Awaited<ReturnType<typeof guildData>>,
) {
  const user = interaction.options.getUser("user", true);
  if (user.id === interaction.user.id)
    return interaction.reply({
      content: "You cannot give reputation to yourself.",
      ephemeral: true,
    });
  const amount = interaction.options.getInteger("amount", true);
  const stats = statsFor(guild, user.id);
  stats.reputation = (stats.reputation ?? 0) + amount;
  await logEvent(guild, interaction.guild!.id, "reputation.give", interaction.user.id, user.id, {
    amount,
    reason: interaction.options.getString("reason"),
  });
  await interaction.reply(`${user} received ${amount} reputation.`);
}
async function poll(
  interaction: import("discord.js").ChatInputCommandInteraction,
  guild: Awaited<ReturnType<typeof guildData>>,
) {
  const options = interaction.options
    .getString("options", true)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 5);
  if (options.length < 2)
    return interaction.reply({
      content: "Provide at least two comma-separated options.",
      ephemeral: true,
    });
  const id = guild.polls.length + 1;
  guild.polls.push({
    id,
    question: interaction.options.getString("question", true),
    options,
    votes: {},
    closed: false,
    createdAt: new Date().toISOString(),
  });
  await interaction.reply(
    `Poll #${id}\n**${guild.polls[id - 1].question}**\n${options.map((option, index) => `${index + 1}. ${option}`).join("\n")}\n\nVote with: /pollvote poll:${id} option:1`,
  );
}
async function pollvote(
  interaction: import("discord.js").ChatInputCommandInteraction,
  guild: Awaited<ReturnType<typeof guildData>>,
) {
  const pollRecord = guild.polls.find(
    (item) => item.id === interaction.options.getInteger("poll", true),
  );
  const option = interaction.options.getInteger("option", true);
  if (!pollRecord || pollRecord.closed || !pollRecord.options[option - 1])
    return interaction.reply({
      content: "That poll or option does not exist.",
      ephemeral: true,
    });
  pollRecord.votes[interaction.user.id] = option;
  const counts = pollRecord.options
    .map(
      (label, index) =>
        `${index + 1}. ${label}: ${Object.values(pollRecord.votes).filter((value) => value === index + 1).length}`,
    )
    .join("\n");
  await interaction.reply({
    content: `Vote recorded.\n${counts}`,
    ephemeral: true,
  });
}
async function announce(
  interaction: import("discord.js").ChatInputCommandInteraction,
) {
  const guild = await guildData(interaction.guild?.id ?? "");
  if (!canUse(interaction, "moderation.manage", guild)) return interaction.reply({ content: "You do not have permission to announce.", ephemeral: true });
  if (!interaction.channel?.isTextBased() || !("send" in interaction.channel))
    return interaction.reply({
      content: "This requires a text channel.",
      ephemeral: true,
    });
  await interaction.channel.send({
    embeds: [
      new EmbedBuilder()
        .setTitle("Announcement")
        .setDescription(interaction.options.getString("message", true))
        .setColor(0x2864d7),
    ],
  });
  await interaction.reply({ content: "Announcement sent.", ephemeral: true });
}
async function showBalance(
  interaction: import("discord.js").ChatInputCommandInteraction,
  guild: Awaited<ReturnType<typeof guildData>>,
) {
  const user = interaction.options.getUser("user") ?? interaction.user;
  await interaction.reply({
    content: `${user} has ${statsFor(guild, user.id).balance} coins.`,
    ephemeral: true,
  });
}
async function daily(
  interaction: import("discord.js").ChatInputCommandInteraction,
  guild: Awaited<ReturnType<typeof guildData>>,
) {
  const stats = statsFor(guild, interaction.user.id);
  const today = new Date().toISOString().slice(0, 10);
  if (stats.lastDaily === today)
    return interaction.reply({
      content: "You already claimed today's reward.",
      ephemeral: true,
    });
  stats.lastDaily = today;
  stats.balance += 100;
  await interaction.reply(
    `Daily reward claimed. Your balance is now ${stats.balance} coins.`,
  );
}
async function pay(
  interaction: import("discord.js").ChatInputCommandInteraction,
  guild: Awaited<ReturnType<typeof guildData>>,
) {
  const recipient = interaction.options.getUser("user", true);
  const amount = interaction.options.getInteger("amount", true);
  const senderStats = statsFor(guild, interaction.user.id);
  if (senderStats.balance < amount)
    return interaction.reply({
      content: "Insufficient balance.",
      ephemeral: true,
    });
  senderStats.balance -= amount;
  statsFor(guild, recipient.id).balance += amount;
  await interaction.reply(
    `${interaction.user} paid ${amount} coins to ${recipient}.`,
  );
}
async function createGiveaway(
  interaction: import("discord.js").ChatInputCommandInteraction,
  guild: Awaited<ReturnType<typeof guildData>>,
) {
  const giveaway = {
    id: guild.giveaways.length + 1,
    guildId: interaction.guild!.id,
    channelId: interaction.channelId,
    prize: interaction.options.getString("prize", true),
    winners: interaction.options.getInteger("winners", true),
    endsAt: new Date(
      Date.now() + interaction.options.getInteger("minutes", true) * 60_000,
    ).toISOString(),
    entries: [] as string[],
    ended: false,
    messageId: undefined as string | undefined,
  };
  guild.giveaways.push(giveaway);
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`giveaway:enter:${giveaway.id}`)
      .setLabel("Enter giveaway")
      .setStyle(ButtonStyle.Primary),
  );
  if (!interaction.channel?.isTextBased() || !("send" in interaction.channel))
    return interaction.reply({
      content: "Giveaways require a text channel.",
      ephemeral: true,
    });
  const message = await interaction.channel.send({
    embeds: [
      new EmbedBuilder()
        .setTitle(`Giveaway #${giveaway.id}`)
        .setDescription(
          `Prize: **${giveaway.prize}**\nEnds: <t:${Math.floor(new Date(giveaway.endsAt).getTime() / 1000)}:R>`,
        )
        .setColor(0xf1c40f),
    ],
    components: [row],
  });
  giveaway.messageId = message.id;
  await logEvent(guild, interaction.guild!.id, "giveaway.created", interaction.user.id, String(giveaway.id), { prize: giveaway.prize, messageId: message.id });
  await interaction.reply({
    content: `Giveaway #${giveaway.id} created.`,
    ephemeral: true,
  });
}
async function createDrop(
  interaction: import("discord.js").ChatInputCommandInteraction,
  guild: Awaited<ReturnType<typeof guildData>>,
) {
  if (!interaction.channel?.isTextBased() || !("send" in interaction.channel)) return interaction.reply({ content: "Drops require a text channel.", ephemeral: true });
  const drop = { id: guild.drops.length + 1, guildId: interaction.guild!.id, channelId: interaction.channelId, prize: interaction.options.getString("prize", true), createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + interaction.options.getInteger("minutes", true) * 60_000).toISOString() };
  guild.drops.push(drop);
  const message = await interaction.channel.send({ embeds: [new EmbedBuilder().setTitle(`Drop #${drop.id}`).setDescription(`Prize: **${drop.prize}**\nExpires: <t:${Math.floor(new Date(drop.expiresAt).getTime() / 1000)}:R>`).setColor(0x13a673)], components: [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(`drop:claim:${drop.id}`).setLabel("Claim drop").setStyle(ButtonStyle.Success))] });
  await logEvent(guild, interaction.guild!.id, "drop.created", interaction.user.id, String(drop.id), { messageId: message.id, prize: drop.prize });
  await interaction.reply({ content: `Drop #${drop.id} created.`, ephemeral: true });
}
async function setup(interaction: import("discord.js").ChatInputCommandInteraction, guild: Awaited<ReturnType<typeof guildData>>) {
  await interaction.reply({ content: `Setup status\nLanguage: ${guild.config.language}\nWelcome channel: ${guild.config.welcomeChannelId ?? "not configured"}\nLog channel: ${guild.config.logChannelId ?? "not configured"}\nTicket category: ${guild.config.ticketCategoryId ?? "not configured"}\nExchange channel: ${guild.config.exchangeChannelId ?? "not configured"}`, ephemeral: true });
}

async function openPanelMenu(
  interaction: import("discord.js").ChatInputCommandInteraction,
  guild: Awaited<ReturnType<typeof guildData>>, 
) {
  const options = (guild.config.ticketPanels ?? []).filter((panel) => panel.enabled !== false);
  const menuOptions = options.length
    ? options.map((panel) => {
        const option = new StringSelectMenuOptionBuilder()
          .setLabel(panel.name)
          .setValue(panel.id)
          .setDescription(panel.description ?? "Ticket panel");

        if (panel.emoji) option.setEmoji(panel.emoji);
        return option;
      })
    : [
        new StringSelectMenuOptionBuilder()
          .setLabel("Support")
          .setValue("support")
          .setDescription("Create a support ticket")
          .setEmoji("🎫"),
      ];

  const menu = new StringSelectMenuBuilder()
    .setCustomId("panel:select")
    .setPlaceholder("Choose a panel")
    .addOptions(menuOptions);

  await interaction.reply({
    content: "Choose a panel below.",
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)],
    ephemeral: true,
  });
}

async function handleSelectMenu(
  interaction: import("discord.js").StringSelectMenuInteraction,
) {
  if (!interaction.guild) return;
  const guild = await guildData(interaction.guild.id);
  const panel = (guild.config.ticketPanels ?? []).find((item) => item.id === interaction.values[0]) ?? {
    id: "support",
    name: "Support",
    emoji: "🎫",
    description: "Create a support ticket",
    kind: "support",
    enabled: true,
  };

  if (panel.kind === "support") {
    await interaction.update({ content: `Support panel: **${panel.name}**\n${panel.description ?? "Support ticket selected."}`, components: [] });
    return;
  }

  if (panel.kind === "exchange") {
    await interaction.update({ content: `Exchange panel: **${panel.name}**\n${panel.description ?? "Exchange request selected."}`, components: [] });
    return;
  }

  await interaction.update({ content: `Panel selected: **${panel.name}**\n${panel.description ?? "Staff panel selected."}`, components: [] });
}

async function handleButton(
  interaction: import("discord.js").ButtonInteraction,
) {
  if (!interaction.guild) return;
  const [type, action, rawId] = interaction.customId.split(":");
  const guild = await guildData(interaction.guild.id);
  if (type === "ticket") {
    const ticket = guild.tickets.find((item) => item.id === Number(rawId));
    if (!ticket)
      return interaction.reply({
        content: "Ticket not found.",
        ephemeral: true,
      });
    const isOwner = ticket.userId === interaction.user.id;
    const configuredStaff = !!interaction.member && "roles" in interaction.member && !Array.isArray(interaction.member.roles) && Object.keys(guild.config.rolePermissions ?? {}).length > 0 && interaction.member.roles.cache.some(role => guild.config.rolePermissions?.[role.id]?.includes("tickets.manage"));
    const isStaff =
      interaction.member &&
      typeof interaction.member.permissions !== "string" &&
      (interaction.member.permissions.has(PermissionFlagsBits.ManageChannels) ||
      configuredStaff ||
        (!!guild.config.staffRoleId &&
          "roles" in interaction.member &&
          !Array.isArray(interaction.member.roles) &&
          interaction.member.roles.cache.has(guild.config.staffRoleId)));
    if (!isOwner && !isStaff)
      return interaction.reply({
        content: "Only the ticket owner or support staff can manage this ticket.",
        ephemeral: true,
      });
    if (action === "claim") {
      if (!isStaff)
        return interaction.reply({
          content: "Only support staff can claim tickets.",
          ephemeral: true,
        });
      if (ticket.status === "closed")
        return interaction.reply({ content: "This ticket is closed.", ephemeral: true });
      ticket.status = "claimed";
      ticket.claimedBy = interaction.user.id;
      await interaction.update({
        content: `Ticket claimed by <@${interaction.user.id}>.`,
        components: [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId(`ticket:unclaim:${ticket.id}`).setLabel("Unclaim").setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`ticket:close:${ticket.id}`).setLabel("Close").setStyle(ButtonStyle.Danger),
          ),
        ],
      });
    } else if (action === "unclaim") {
      if (!isStaff) return interaction.reply({ content: "Only support staff can unclaim tickets.", ephemeral: true });
      if (ticket.status !== "claimed") return interaction.reply({ content: "This ticket is not claimed.", ephemeral: true });
      ticket.status = "open";
      ticket.claimedBy = undefined;
      await interaction.update({
        content: `Ticket unclaimed by <@${interaction.user.id}>.`,
        components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId(`ticket:claim:${ticket.id}`).setLabel("Claim").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId(`ticket:close:${ticket.id}`).setLabel("Close").setStyle(ButtonStyle.Danger),
        )],
      });
    } else if (action === "close") {
      if (isOwner && guild.config.ticketOwnerCanClose === false && !isStaff)
        return interaction.reply({ content: "Only support staff can close this ticket.", ephemeral: true });
      await createTranscript(interaction, guild, ticket);
      ticket.status = "closed";
      ticket.closedAt = new Date().toISOString();
      if (interaction.channel && "edit" in interaction.channel && "name" in interaction.channel) {
        await interaction.channel.edit({ name: interaction.channel.name.startsWith("closed-") ? interaction.channel.name : `closed-${interaction.channel.name}` });
      }
      await interaction.update({
        content: `Ticket closed by <@${interaction.user.id}>. Reopen or delete it below.`,
        components: [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId(`ticket:reopen:${ticket.id}`).setLabel("Reopen").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`ticket:delete:${ticket.id}`).setLabel("Delete").setStyle(ButtonStyle.Danger),
          ),
        ],
      });
    } else if (action === "reopen") {
      if (ticket.status !== "closed") return interaction.reply({ content: "This ticket is already open.", ephemeral: true });
      ticket.status = "open";
      ticket.closedAt = undefined;
      if (interaction.channel && "edit" in interaction.channel && "name" in interaction.channel) {
        await interaction.channel.edit({ name: interaction.channel.name.replace(/^closed-/, "") });
      }
      await interaction.update({
        content: `Ticket reopened by <@${interaction.user.id}>.`,
        components: [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId(`ticket:claim:${ticket.id}`).setLabel("Claim").setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`ticket:close:${ticket.id}`).setLabel("Close").setStyle(ButtonStyle.Danger),
          ),
        ],
      });
    } else if (action === "delete") {
      guild.tickets = guild.tickets.filter((item) => item.id !== ticket.id);
      await interaction.reply({ content: "Deleting ticket...", ephemeral: true });
      if (interaction.channel && "delete" in interaction.channel) await interaction.channel.delete("Ticket deleted");
    }
  } else if (
    type === "exchange" &&
    (action === "approve" || action === "reject")
  ) {
    const request = guild.exchanges.find((item) => item.id === rawId);
    if (!request)
      return interaction.reply({
        content: "Request not found.",
        ephemeral: true,
      });
    if (
      !interaction.member ||
      typeof interaction.member.permissions === "string" ||
      !canUseButton(interaction, action === "approve" ? "exchange.approve" : "exchange.review", guild)
    )
      return interaction.reply({
        content: "You need Manage Server to review exchanges.",
        ephemeral: true,
      });
    if (action === "reject") {
      const modal = new ModalBuilder()
        .setCustomId(`exchange-reject:${rawId}`)
        .setTitle("Reject exchange")
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId("reason")
              .setLabel("Reason")
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(true),
          ),
        );
      return interaction.showModal(modal);
    }
    request.status = "approved";
    request.reviewedBy = interaction.user.id;
    await logEvent(guild, interaction.guild.id, "exchange.approved", interaction.user.id, request.id);
    const requester = await client.users.fetch(request.userId).catch(() => null);
    await requester?.send(`Your exchange ${request.id} was approved.`).catch(() => undefined);
    const publishChannelId = guild.config.exchangePublishChannelId ?? guild.config.exchangeChannelId;
    const publishChannel = publishChannelId ? interaction.guild.channels.cache.get(publishChannelId) : undefined;
    if (publishChannel?.isTextBased() && "send" in publishChannel) {
      await publishChannel.send({ content: `<@${request.userId}>`, embeds: [new EmbedBuilder().setTitle(`Exchange ${request.id}`).setDescription(request.description).setImage(request.bannerUrl ?? null).addFields({ name: "Link", value: request.link ?? "None" }).setColor(0x13a673)], allowedMentions: { users: [request.userId] } });
    }
    await interaction.update({
      content: `Exchange ${rawId} approved by ${interaction.user}.`,
      embeds: [],
      components: [],
    });
  } else if (type === "giveaway" && action === "enter") {
    const giveaway = guild.giveaways.find((item) => item.id === Number(rawId));
    if (!giveaway || giveaway.ended || new Date(giveaway.endsAt) <= new Date())
      return interaction.reply({
        content: "This giveaway has ended.",
        ephemeral: true,
      });
    if (giveaway.entries.includes(interaction.user.id))
      return interaction.reply({
        content: "You are already entered.",
        ephemeral: true,
      });
    giveaway.entries.push(interaction.user.id);
    await logEvent(guild, interaction.guild.id, "giveaway.entered", interaction.user.id, String(giveaway.id));
    await interaction.reply({
      content: "You entered the giveaway!",
      ephemeral: true,
    });
  } else if (type === "drop" && action === "claim") {
    const drop = guild.drops.find(item => item.id === Number(rawId));
    if (!drop || drop.claimedBy || new Date(drop.expiresAt) <= new Date()) return interaction.reply({ content: "This drop is no longer available.", ephemeral: true });
    drop.claimedBy = interaction.user.id;
    await logEvent(guild, interaction.guild.id, "drop.claimed", interaction.user.id, String(drop.id));
    await interaction.update({ content: `Drop claimed by <@${interaction.user.id}>.`, embeds: [], components: [] });
  }
  await save();
}

function canUseButton(interaction: import("discord.js").ButtonInteraction, action: PermissionAction, guild: Awaited<ReturnType<typeof guildData>>): boolean {
  if (!interaction.member || typeof interaction.member.permissions === "string") return false;
  if (interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  if ("roles" in interaction.member && !Array.isArray(interaction.member.roles)) {
    const roleMap = guild.config.rolePermissions ?? {};
    if (Object.keys(roleMap).length === 0) return interaction.member.permissions.has(PermissionFlagsBits.ManageGuild);
    return interaction.member.roles.cache.some(role => roleMap[role.id]?.includes(action));
  }
  return false;
}
async function handleModal(
  interaction: import("discord.js").ModalSubmitInteraction,
) {
  if (
    !interaction.guild ||
    !interaction.customId.startsWith("exchange-reject:")
  )
    return;
  const guild = await guildData(interaction.guild.id);
  const request = guild.exchanges.find(
    (item) => item.id === interaction.customId.split(":")[1],
  );
  if (!request)
    return interaction.reply({
      content: "Request not found.",
      ephemeral: true,
    });
  request.status = "rejected";
  request.reason = interaction.fields.getTextInputValue("reason");
  request.reviewedBy = interaction.user.id;
  await logEvent(guild, interaction.guild.id, "exchange.rejected", interaction.user.id, request.id, { reason: request.reason });
  const requester = await client.users.fetch(request.userId).catch(() => null);
  await requester?.send(`Your exchange ${request.id} was declined.${request.reason ? ` Reason: ${request.reason}` : ""}`).catch(() => undefined);
  await interaction.reply({
    content: `Exchange ${request.id} rejected.`,
    ephemeral: true,
  });
  await save();
}

async function bootstrap() {
  await registerGuildCommands();
  await client.login(token);
}

bootstrap().catch((error) => {
  console.error("Bot failed to start:", error);
  process.exit(1);
});
