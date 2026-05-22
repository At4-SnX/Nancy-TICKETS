// nancyticket.js
// Bot : Nancy TICKET — Système de tickets complet (Discord.js v14+)

require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  Partials,
  StringSelectMenuBuilder,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");
const fs = require("fs");

// ─────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────

const TOKEN = process.env.TOKEN;

const STAFF_ROLE = "1505943612507295826";
const LOCK_ROLE = "1505943624200884426";
const LOG_CHANNEL = "1506375933051932753";

const CATEGORY_IDS = {
  question: "1506374094906720387",
  partenariat: "1506374190956281997",
  reportstaff: "1506374327509979186",
  reportjoueur: "1506374389137149982",
  legal: "1505943608832819282",
  illegal: "1505943610141442129",
  fondation: "1506374573535268885",
  unban: "1506374094906720387" // tu peux changer si tu veux une autre catégorie
};

const THEME_COLOR = "#5865F2";

// ─────────────────────────────────────────────
// CLIENT
// ─────────────────────────────────────────────

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel, Partials.Message, Partials.GuildMember, Partials.User]
});

// ─────────────────────────────────────────────
// READY
// ─────────────────────────────────────────────

client.once("ready", () => {
  console.log(`✅ Nancy TICKET lancé en tant que ${client.user.tag}`);
});

// ─────────────────────────────────────────────
// PANEL : !sendpanel (ADMIN ONLY)
// ─────────────────────────────────────────────

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (message.content !== "!sendpanel") return;
  if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;

  const menu = new StringSelectMenuBuilder()
    .setCustomId("ticket_menu")
    .setPlaceholder("📂 Choisissez une catégorie de ticket")
    .addOptions([
      { label: "Question", value: "question", emoji: "❓" },
      { label: "Partenariat", value: "partenariat", emoji: "🤝" },
      { label: "Report Staff", value: "reportstaff", emoji: "🛡️" },
      { label: "Report Joueur", value: "reportjoueur", emoji: "⚠️" },
      { label: "Demande Légal", value: "legal", emoji: "📘" },
      { label: "Demande Illégal", value: "illegal", emoji: "📕" },
      { label: "Fondation", value: "fondation", emoji: "🏛️" },
      { label: "Demande d’unban", value: "unban", emoji: "🔓" }
    ]);

  await message.channel.send({
    components: [new ActionRowBuilder().addComponents(menu)]
  });

  await message.delete().catch(() => {});
});

// ─────────────────────────────────────────────
// INTERACTIONS : MENU → MODAL → TICKET
// ─────────────────────────────────────────────

client.on("interactionCreate", async (interaction) => {
  try {
    // ───────────── MENU → MODAL ─────────────
    if (interaction.isStringSelectMenu() && interaction.customId === "ticket_menu") {
      const type = interaction.values[0];

      const modal = new ModalBuilder()
        .setCustomId(`ticket_form_${type}`)
        .setTitle("🎫 Création d’un ticket");

      if (type === "reportjoueur") {
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId("ticket_joueur")
              .setLabel("Nom du joueur")
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId("ticket_raison")
              .setLabel("Raison du report")
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId("ticket_preuve")
              .setLabel("Preuve (facultatif)")
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(false)
          )
        );
      }

      else if (type === "unban") {
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId("ticket_unban_nom")
              .setLabel("Nom RP / Discord")
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId("ticket_unban_raison")
              .setLabel("Pourquoi devrions-nous te déban ?")
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(true)
          )
        );
      }

      else {
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId("ticket_details")
              .setLabel("Détails de la demande")
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(true)
          )
        );
      }

      return interaction.showModal(modal);
    }

    // ───────────── MODAL → CRÉATION DU TICKET ─────────────
    if (interaction.isModalSubmit() && interaction.customId.startsWith("ticket_form_")) {
      const type = interaction.customId.replace("ticket_form_", "");

      const categoryId = CATEGORY_IDS[type];

      const existing = interaction.guild.channels.cache.find(
        (c) => c.name === `ticket-${interaction.user.id}`
      );

      if (existing) {
        return interaction.reply({
          content: "❌ Tu as déjà un ticket ouvert.",
          ephemeral: true
        });
      }

      let description = "";

      if (type === "reportjoueur") {
        description =
          `**Type : Report Joueur**\n` +
          `**Joueur :** ${interaction.fields.getTextInputValue("ticket_joueur")}\n` +
          `**Raison :** ${interaction.fields.getTextInputValue("ticket_raison")}\n` +
          `**Preuve :** ${interaction.fields.getTextInputValue("ticket_preuve") || "Aucune"}`;
      }

      else if (type === "unban") {
        description =
          `**Type : Demande d’unban**\n` +
          `**Nom :** ${interaction.fields.getTextInputValue("ticket_unban_nom")}\n` +
          `**Raison :** ${interaction.fields.getTextInputValue("ticket_unban_raison")}`;
      }

      else {
        description =
          `**Type : ${type}**\n` +
          `**Détails :**\n${interaction.fields.getTextInputValue("ticket_details")}`;
      }

      const channel = await interaction.guild.channels.create({
        name: `ticket-${interaction.user.id}`,
        type: ChannelType.GuildText,
        parent: categoryId,
        permissionOverwrites: [
          { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
          { id: STAFF_ROLE, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
        ]
      });

      const embed = new EmbedBuilder()
        .setColor(THEME_COLOR)
        .setTitle("🟦 Bienvenue sur le support de Nancy RP 🟦")
        .setDescription(description)
        .setFooter({ text: "Nancy TICKET — Support" })
        .setTimestamp();

      // ───────────── MENUS DE BOUTONS (SelectMenu) ─────────────
      const controlMenu = new StringSelectMenuBuilder()
        .setCustomId("ticket_controls")
        .setPlaceholder("⚙️ Actions du ticket")
        .addOptions([
          { label: "🧷 Claim", value: "claim" },
          { label: "🔒 Lock", value: "lock" },
          { label: "🔔 Appel Staff", value: "call" },
          { label: "➕ Ajouter un membre", value: "adduser" },
          { label: "🗑️ Fermer", value: "close" }
        ]);

      await channel.send({
        content: `<@${interaction.user.id}> <@&${STAFF_ROLE}>`,
        embeds: [embed],
        components: [new ActionRowBuilder().addComponents(controlMenu)]
      });

      return interaction.reply({
        content: `🎫 Ton ticket a été créé : ${channel}`,
        ephemeral: true
      });
    }

    // ───────────── MENU DE CONTRÔLE DU TICKET ─────────────
    if (interaction.isStringSelectMenu() && interaction.customId === "ticket_controls") {
      const action = interaction.values[0];
      const channel = interaction.channel;
      const member = interaction.member;

      // Claim
      if (action === "claim") {
        if (!member.roles.cache.has(STAFF_ROLE)) {
          return interaction.reply({ content: "❌ Tu n'es pas staff.", ephemeral: true });
        }
        return interaction.reply(`🧷 Ticket pris en charge par <@${interaction.user.id}>`);
      }

      // Lock
      if (action === "lock") {
        const ownerId = channel.name.replace("ticket-", "");
        await channel.permissionOverwrites.edit(ownerId, { SendMessages: false });
        return interaction.reply("🔒 Ticket verrouillé.");
      }

      // Appel Staff
      if (action === "call") {
        return interaction.reply(`<@&${STAFF_ROLE}> 🔔 Un staff est demandé ici.`);
      }

      // Ajouter un membre
      if (action === "adduser") {
        const modal = new ModalBuilder()
          .setCustomId("add_user_modal")
          .setTitle("➕ Ajouter un membre");

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId("user_id")
              .setLabel("ID du membre à ajouter")
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
          )
        );

        return interaction.showModal(modal);
      }

      // Fermer
      if (action === "close") {
        return interaction.reply({
          content: "⚠️ Confirmer la fermeture ?",
          components: [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId("confirm_close").setLabel("Confirmer").setStyle(ButtonStyle.Danger),
              new ButtonBuilder().setCustomId("cancel_close").setLabel("Annuler").setStyle(ButtonStyle.Secondary)
            )
          ]
        });
      }
    }

    // ───────────── AJOUT D’UN MEMBRE ─────────────
    if (interaction.isModalSubmit() && interaction.customId === "add_user_modal") {
      const userId = interaction.fields.getTextInputValue("user_id");

      try {
        await interaction.channel.permissionOverwrites.edit(userId, {
          ViewChannel: true,
          SendMessages: true
        });

        return interaction.reply(`➕ <@${userId}> a été ajouté au ticket.`);
      } catch {
        return interaction.reply({ content: "❌ ID invalide.", ephemeral: true });
      }
    }

    // ───────────── FERMETURE DU TICKET ─────────────
    if (interaction.isButton()) {
      if (interaction.customId === "cancel_close") {
        return interaction.update({ content: "❌ Fermeture annulée.", components: [] });
      }

      if (interaction.customId === "confirm_close") {
        await interaction.update({ content: "🗑️ Fermeture dans 2 secondes…", components: [] });

        const messages = await interaction.channel.messages.fetch({ limit: 100 });
        const transcript = messages.reverse().map(m => `${m.author.tag}: ${m.content}`).join("\n");

        const fileName = `transcript-${interaction.channel.id}.txt`;
        fs.writeFileSync(fileName, transcript);

        const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL);
        if (logChannel) {
          await logChannel.send({
            content: `📄 Transcript du ticket **${interaction.channel.name}**`,
            files: [fileName]
          });
        }

        setTimeout(() => {
          interaction.channel.delete().catch(() => {});
          fs.unlink(fileName, () => {});
        }, 2000);
      }
    }

  } catch (err) {
    console.error("Erreur :", err);
  }
});

// ─────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────

client.login(TOKEN);
