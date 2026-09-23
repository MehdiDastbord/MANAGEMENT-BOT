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
    .setName("ban").setDescription("Ban a member")
    .addUserOption((o) => o.setName("user").setDescription("Member").setRequired(true))
    .addStringOption((o) => o.setName("reason").setDescription("Reason"))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
  new SlashCommandBuilder()
    .setName("unban").setDescription("Unban a user")
    .addStringOption((o) => o.setName("user_id").setDescription("User ID").setRequired(true))
    .addStringOption((o) => o.setName("reason").setDescription("Reason"))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
  new SlashCommandBuilder()
    .setName("kick").setDescription("Kick a member")
    .addUserOption((o) => o.setName("user").setDescription("Member").setRequired(true))
    .addStringOption((o) => o.setName("reason").setDescription("Reason"))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
  new SlashCommandBuilder()
    .setName("untimeout").setDescription("Remove a member timeout")
    .addUserOption((o) => o.setName("user").setDescription("Member").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  new SlashCommandBuilder()
    .setName("unwarn").setDescription("Remove a warning")
    .addIntegerOption((o) => o.setName("case").setDescription("Warning number").setMinValue(1).setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  new SlashCommandBuilder()
    .setName("lock").setDescription("Lock the current channel")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  new SlashCommandBuilder()
    .setName("unlock").setDescription("Unlock the current channel")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  new SlashCommandBuilder()
    .setName("slowmode").setDescription("Set channel slowmode")
    .addIntegerOption((o) => o.setName("seconds").setDescription("0-21600 seconds").setMinValue(0).setMaxValue(21600).setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
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
    .setName("panel")
    .setDescription("Open the server panel menu"),
  new SlashCommandBuilder()
    .setName("exchange")
    .setDescription("Submit an exchange request")
    .addStringOption((o) =>
      o.setName("title").setDescription("Title").setMaxLength(200).setRequired(true),
    )
    .addStringOption((o) =>
      o.setName("description").setDescription("Full banner description").setMaxLength(4000).setRequired(true),
    )
    .addStringOption((o) => o.setName("link").setDescription("Optional link").setMaxLength(500))
    .addAttachmentOption((o) => o.setName("banner").setDescription("Upload your full banner image").setRequired(true)),
  new SlashCommandBuilder()
    .setName("rank")
    .setDescription("View your rank")
    .addUserOption((o) => o.setName("user").setDescription("Member")),
  new SlashCommandBuilder()
    .setName("level").setDescription("View a member's level")
    .addUserOption((o) => o.setName("user").setDescription("Member")),
  new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("Show the XP leaderboard"),
  new SlashCommandBuilder()
    .setName("invites")
    .setDescription("View invite statistics")
    .addUserOption((o) => o.setName("user").setDescription("Member")),
  new SlashCommandBuilder()
    .setName("invite-leaderboard").setDescription("Show the invite leaderboard"),
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
    .setName("drop").setDescription("Create a claimable drop")
    .addStringOption((o) => o.setName("prize").setDescription("Prize").setRequired(true))
    .addIntegerOption((o) => o.setName("minutes").setDescription("Expiry in minutes").setMinValue(1).setMaxValue(1440).setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder()
    .setName("setup").setDescription("Show server setup status")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder()
    .setName("config")
    .setDescription("View bot configuration")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
].map((command) => command.toJSON());
