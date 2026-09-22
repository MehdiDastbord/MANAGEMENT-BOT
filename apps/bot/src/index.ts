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
    else if (interaction.commandName === "exchange")
      await createExchange(interaction, guild);
    else if (interaction.commandName === "rank")
      await showRank(interaction, guild);
    else if (interaction.commandName === "leaderboard")
      await leaderboard(interaction, guild);
    else if (interaction.commandName === "invites")
      await invites(interaction, guild);
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
    else if (interaction.commandName === "config")
      await interaction.reply({
        content: `Language: ${guild.config.language}\nLog channel: ${guild.config.logChannelId ?? "not configured"}\nWelcome channel: ${guild.config.welcomeChannelId ?? "not configured"}\nTicket category: ${guild.config.ticketCategoryId ?? "not configured"}`,
        ephemeral: true,
      });
    addAudit(guild, `command.${interaction.commandName}`, interaction.user.id);
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
    addAudit(guild, "member.join", undefined, member.id);
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
    addAudit(guild, "member.leave", undefined, member.id);
    await save();
  })();
});

client.on("messageCreate", (message) => {
  if (!message.guild || message.author.bot) return;
  void (async () => {
    const guild = await guildData(message.guild!.id);
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
      addAudit(guild, "automod.action", client.user?.id, message.author.id, {
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
      await message.channel.send(
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
  if (!canUse(interaction, "moderation.warn")) return interaction.reply({ content: "You do not have permission to warn members.", ephemeral: true });
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
function canUse(interaction: import("discord.js").ChatInputCommandInteraction, action: PermissionAction): boolean {
  if (!interaction.member || typeof interaction.member.permissions === "string") return false;
  if (interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  const permissions = interaction.member.permissions;
  if (action.startsWith("moderation.") && permissions.has(PermissionFlagsBits.ModerateMembers)) return true;
  if (action === "channels.manage" && permissions.has(PermissionFlagsBits.ManageChannels)) return true;
  if (action === "moderation.ban" && permissions.has(PermissionFlagsBits.BanMembers)) return true;
  if (action === "moderation.kick" && permissions.has(PermissionFlagsBits.KickMembers)) return true;
  if ("roles" in interaction.member && !Array.isArray(interaction.member.roles)) {
    return hasPermission(interaction.member.roles.cache.map(role => role.name.toLowerCase()), action, {
      moderator: ["moderation.warn", "moderation.manage", "moderation.kick", "moderation.timeout"],
      administrator: ["moderation.warn", "moderation.manage", "moderation.ban", "moderation.kick", "moderation.timeout", "channels.manage"],
    });
  }
  return false;
}
async function ban(interaction: import("discord.js").ChatInputCommandInteraction, guild: Awaited<ReturnType<typeof guildData>>) {
  if (!canUse(interaction, "moderation.ban")) return interaction.reply({ content: "You do not have permission to ban members.", ephemeral: true });
  const user = interaction.options.getUser("user", true);
  const reason = interaction.options.getString("reason") ?? "No reason provided";
  await interaction.guild!.members.ban(user, { reason });
  addAudit(guild, "moderation.ban", interaction.user.id, user.id, { reason });
  await interaction.reply(`${user.tag} was banned.`);
}
async function unban(interaction: import("discord.js").ChatInputCommandInteraction, guild: Awaited<ReturnType<typeof guildData>>) {
  if (!canUse(interaction, "moderation.ban")) return interaction.reply({ content: "You do not have permission to unban members.", ephemeral: true });
  const userId = interaction.options.getString("user_id", true);
  const reason = interaction.options.getString("reason") ?? "No reason provided";
  await interaction.guild!.members.unban(userId, reason);
  addAudit(guild, "moderation.unban", interaction.user.id, userId, { reason });
  await interaction.reply(`User ${userId} was unbanned.`);
}
async function kick(interaction: import("discord.js").ChatInputCommandInteraction, guild: Awaited<ReturnType<typeof guildData>>) {
  if (!canUse(interaction, "moderation.kick")) return interaction.reply({ content: "You do not have permission to kick members.", ephemeral: true });
  const user = interaction.options.getUser("user", true);
  const member = await interaction.guild!.members.fetch(user.id);
  if (!member.kickable) return interaction.reply({ content: "I cannot kick that member because of role hierarchy.", ephemeral: true });
  const reason = interaction.options.getString("reason") ?? "No reason provided";
  await member.kick(reason);
  addAudit(guild, "moderation.kick", interaction.user.id, user.id, { reason });
  await interaction.reply(`${user.tag} was kicked.`);
}
async function untimeout(interaction: import("discord.js").ChatInputCommandInteraction, guild: Awaited<ReturnType<typeof guildData>>) {
  if (!canUse(interaction, "moderation.timeout")) return interaction.reply({ content: "You do not have permission to remove timeouts.", ephemeral: true });
  const user = interaction.options.getUser("user", true);
  const member = await interaction.guild!.members.fetch(user.id);
  if (!member.moderatable) return interaction.reply({ content: "I cannot modify that member because of role hierarchy.", ephemeral: true });
  await member.timeout(null, "Timeout removed");
  addAudit(guild, "moderation.untimeout", interaction.user.id, user.id);
  await interaction.reply(`Timeout removed for ${user.tag}.`);
}
async function unwarn(interaction: import("discord.js").ChatInputCommandInteraction, guild: Awaited<ReturnType<typeof guildData>>) {
  if (!canUse(interaction, "moderation.warn")) return interaction.reply({ content: "You do not have permission to remove warnings.", ephemeral: true });
  const id = interaction.options.getInteger("case", true);
  const index = guild.warnings.findIndex(warning => warning.id === id);
  if (index < 0) return interaction.reply({ content: "Warning not found.", ephemeral: true });
  const [warning] = guild.warnings.splice(index, 1);
  addAudit(guild, "moderation.unwarn", interaction.user.id, warning.userId, { warningId: id });
  await interaction.reply(`Warning #${id} removed.`);
}
async function lockChannel(interaction: import("discord.js").ChatInputCommandInteraction, guild: Awaited<ReturnType<typeof guildData>>, locked: boolean) {
  if (!canUse(interaction, "channels.manage")) return interaction.reply({ content: "You do not have permission to manage channels.", ephemeral: true });
  if (!interaction.channel || !interaction.guild || !("permissionOverwrites" in interaction.channel)) return interaction.reply({ content: "This command requires a guild channel.", ephemeral: true });
  await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: locked ? false : null });
  addAudit(guild, locked ? "channel.lock" : "channel.unlock", interaction.user.id, interaction.channelId);
  await interaction.reply({ content: locked ? "Channel locked." : "Channel unlocked.", ephemeral: true });
}
async function slowmode(interaction: import("discord.js").ChatInputCommandInteraction, guild: Awaited<ReturnType<typeof guildData>>) {
  if (!canUse(interaction, "channels.manage")) return interaction.reply({ content: "You do not have permission to manage channels.", ephemeral: true });
  if (!interaction.channel || !interaction.channel.isTextBased() || !("setRateLimitPerUser" in interaction.channel)) return interaction.reply({ content: "This command requires a text channel.", ephemeral: true });
  const seconds = interaction.options.getInteger("seconds", true);
  await interaction.channel.setRateLimitPerUser(seconds);
  addAudit(guild, "channel.slowmode", interaction.user.id, interaction.channelId, { seconds });
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
  addAudit(guild, "moderation.timeout", interaction.user.id, user.id, {
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
  if (guild.config.staffRoleId)
    permissionOverwrites.push({
      id: guild.config.staffRoleId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    });
  const channel = await interaction.guild!.channels.create({
    name: `ticket-${interaction.user.username}`.slice(0, 90),
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
    content: `${interaction.user}, support staff will be with you shortly.`,
    components: [row],
  });
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
  if (guild.config.logChannelId) {
    const logChannel = interaction.guild?.channels.cache.get(guild.config.logChannelId);
    if (logChannel?.isTextBased() && "send" in logChannel) {
      await logChannel.send({ content: `Transcript for ticket #${ticket.id}`, files: [{ attachment: Buffer.from(content || "No messages", "utf8"), name: `ticket-${ticket.id}-transcript.txt` }] });
    }
  }
}
async function createExchange(
  interaction: import("discord.js").ChatInputCommandInteraction,
  guild: Awaited<ReturnType<typeof guildData>>,
) {
  const requestId = `EX-${Date.now().toString(36).toUpperCase()}`;
  const request = {
    id: requestId,
    guildId: interaction.guild!.id,
    userId: interaction.user.id,
    title: interaction.options.getString("title", true),
    description: interaction.options.getString("description", true),
    link: interaction.options.getString("link") ?? undefined,
    status: "pending" as const,
    createdAt: new Date().toISOString(),
  };
  guild.exchanges.push(request);
  const channel = guild.config.exchangeChannelId
    ? interaction.guild!.channels.cache.get(guild.config.exchangeChannelId)
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
      embeds: [
        new EmbedBuilder()
          .setTitle(`Exchange ${requestId}`)
          .setDescription(`${request.title}\n\n${request.description}`)
          .setColor(0x5865f2)
          .addFields(
            { name: "Requester", value: `<@${request.userId}>` },
            { name: "Link", value: request.link ?? "None" },
          ),
      ],
      components: [row],
    });
  }
  await interaction.reply({
    content: `Exchange request ${requestId} submitted.`,
    ephemeral: true,
  });
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
  addAudit(guild, "reputation.give", interaction.user.id, user.id, {
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
  await interaction.reply({
    content: `Giveaway #${giveaway.id} created.`,
    ephemeral: true,
  });
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
    const isStaff =
      interaction.member &&
      typeof interaction.member.permissions !== "string" &&
      (interaction.member.permissions.has(PermissionFlagsBits.ManageChannels) ||
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
            new ButtonBuilder().setCustomId(`ticket:close:${ticket.id}`).setLabel("Close").setStyle(ButtonStyle.Danger),
          ),
        ],
      });
    } else if (action === "close") {
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
      !interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)
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
    await interaction.reply({
      content: "You entered the giveaway!",
      ephemeral: true,
    });
  }
  await save();
}
async function handleModal(
  interaction: import("discord.js").ModalSubmitInteraction,
) {
  if (
    !interaction.guild ||
    !interaction.customId.startsWith("exchange-reject:")
  )
    return;
  const request = (await guildData(interaction.guild.id)).exchanges.find(
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
