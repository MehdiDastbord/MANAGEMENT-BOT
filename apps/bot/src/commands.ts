import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

export const commands = [
  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check bot responsiveness"),
  new SlashCommandBuilder().setName("status").setDescription("Show bot status"),
  new SlashCommandBuilder()
    .setName("help")
    .setDescription("Show available commands"),
  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn a member")
    .addUserOption((o) =>
      o.setName("user").setDescription("Member").setRequired(true),
    )
    .addStringOption((o) =>
      o.setName("reason").setDescription("Reason").setRequired(true),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  new SlashCommandBuilder()
    .setName("warnings")
    .setDescription("View member warnings")
    .addUserOption((o) =>
      o.setName("user").setDescription("Member").setRequired(true),
    ),
  new SlashCommandBuilder()
    .setName("clear")
    .setDescription("Delete recent messages")
    .addIntegerOption((o) =>
      o
        .setName("amount")
        .setDescription("1-100")
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("Timeout a member")
    .addUserOption((o) =>
      o.setName("user").setDescription("Member").setRequired(true),
    )
    .addIntegerOption((o) =>
      o
        .setName("minutes")
        .setDescription("Duration")
        .setMinValue(1)
        .setMaxValue(40320)
        .setRequired(true),
    )
    .addStringOption((o) => o.setName("reason").setDescription("Reason")),
  new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("Create a private support ticket"),
  new SlashCommandBuilder()
    .setName("exchange")
    .setDescription("Submit an exchange request")
    .addStringOption((o) =>
      o.setName("title").setDescription("Title").setRequired(true),
    )
    .addStringOption((o) =>
      o.setName("description").setDescription("Description").setRequired(true),
    )
    .addStringOption((o) => o.setName("link").setDescription("Optional link")),
  new SlashCommandBuilder()
    .setName("rank")
    .setDescription("View your rank")
    .addUserOption((o) => o.setName("user").setDescription("Member")),
  new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("Show the XP leaderboard"),
  new SlashCommandBuilder()
    .setName("invites")
    .setDescription("View invite statistics")
    .addUserOption((o) => o.setName("user").setDescription("Member")),
  new SlashCommandBuilder()
    .setName("rep")
    .setDescription("Give reputation to a member")
    .addUserOption((o) =>
      o.setName("user").setDescription("Member").setRequired(true),
    )
    .addIntegerOption((o) =>
      o
        .setName("amount")
        .setDescription("Amount")
        .setMinValue(1)
        .setMaxValue(5)
        .setRequired(true),
    )
    .addStringOption((o) => o.setName("reason").setDescription("Reason")),
  new SlashCommandBuilder()
    .setName("poll")
    .setDescription("Create a poll")
    .addStringOption((o) =>
      o.setName("question").setDescription("Question").setRequired(true),
    )
    .addStringOption((o) =>
      o
        .setName("options")
        .setDescription("Comma-separated options")
        .setRequired(true),
    ),
  new SlashCommandBuilder()
    .setName("pollvote")
    .setDescription("Vote in a poll")
    .addIntegerOption((o) =>
      o
        .setName("poll")
        .setDescription("Poll ID")
        .setMinValue(1)
        .setRequired(true),
    )
    .addIntegerOption((o) =>
      o
        .setName("option")
        .setDescription("Option number")
        .setMinValue(1)
        .setMaxValue(5)
        .setRequired(true),
    ),
  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Send an announcement")
    .addStringOption((o) =>
      o.setName("message").setDescription("Announcement").setRequired(true),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder()
    .setName("balance")
    .setDescription("View your balance")
    .addUserOption((o) => o.setName("user").setDescription("Member")),
  new SlashCommandBuilder()
    .setName("daily")
    .setDescription("Claim your daily reward"),
  new SlashCommandBuilder()
    .setName("pay")
    .setDescription("Pay another member")
    .addUserOption((o) =>
      o.setName("user").setDescription("Member").setRequired(true),
    )
    .addIntegerOption((o) =>
      o
        .setName("amount")
        .setDescription("Amount")
        .setMinValue(1)
        .setRequired(true),
    ),
  new SlashCommandBuilder()
    .setName("giveaway")
    .setDescription("Create a giveaway")
    .addStringOption((o) =>
      o.setName("prize").setDescription("Prize").setRequired(true),
    )
    .addIntegerOption((o) =>
      o
        .setName("minutes")
        .setDescription("Duration")
        .setMinValue(1)
        .setMaxValue(10080)
        .setRequired(true),
    )
    .addIntegerOption((o) =>
      o
        .setName("winners")
        .setDescription("Winner count")
        .setMinValue(1)
        .setMaxValue(20)
        .setRequired(true),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder()
    .setName("config")
    .setDescription("View bot configuration")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
].map((command) => command.toJSON());
