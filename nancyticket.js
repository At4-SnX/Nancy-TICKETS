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
if (!TOKEN) {
  console.error("❌ TOKEN manquant dans le fichier .env");
  process.exit(1);
}

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
  fondation: "1506374573535268885"
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
  console.log(`✅ Connecté en tant que ${client.user.tag} (Nancy TICKET)`);
});

// ─────────────────────────────────────────────
// PANEL : !sendpanel (ADMIN ONLY) — MENU UNIQUEMENT
// ─────────────────────────────────────────────

client.on("messageCreate", async (message) => {
  try {
    if (message.author.bot) return;
    if (message.content !== "!sendpanel") return;
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;

    const menu = new StringSelectMenuBuilder()
      .setCustomId("ticket_menu")
      .setPlaceholder("📂 Choisissez une catégorie de ticket")
      .addOptions([
        { label: "Question", value: "question", emoji: "❓", description: "Poser une question au staff" },
        { label: "Partenariat", value: "partenariat", emoji: "🤝", description: "Demande de partenariat" },
        { label: "Report Staff", value: "reportstaff", emoji: "🛡️", description: "Signaler un membre du staff" },
        { label: "Report Joueur", value: "reportjoueur", emoji: "⚠️", description: "Signaler un joueur" },
        { label: "Demande Légal", value: "legal", emoji: "📘", description: "Demande liée au RP légal" },
        { label: "Demande Illégal", value: "illegal", emoji: "📕", description: "Demande liée au RP illégal" },
        { label: "Fondation", value: "fondation", emoji: "🏛️", description: "Demande liée à la fondation" }
      ]);

    await message.channel.send({
      components: [new ActionRowBuilder().addComponents(menu)]
    });

    await message.delete().catch(() => {});
  } catch (err) {
    console.error("Erreur !sendpanel :", err);
  }
});

// ─────────────────────────────────────────────
// INTERACTIONS : MENU → MODAL → TICKET
// ─────────────────────────────────────────────

client.on("interactionCreate", async (interaction) => {
  try {
    // ───────────── MENU DE TICKET → OUVERTURE MODAL ─────────────
    if (interaction.isStringSelectMenu() && interaction.customId === "ticket_menu") {
      const type = interaction.values[0];

      const modal = new ModalBuilder()
        .setCustomId(`ticket_form_${type}`)
        .setTitle("🎫 Création d’un ticket");

      if (type === "reportjoueur") {
        const joueur = new TextInputBuilder()
          .setCustomId("ticket_joueur")
          .setLabel("Nom du joueur")
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const raison = new TextInputBuilder()
          .setCustomId("ticket_raison")
          .setLabel("Raison du report")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true);

        const preuve = new TextInputBuilder()
          .setCustomId("ticket_preuve")
          .setLabel("Preuve (lien / explication)")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false);

        modal.addComponents(
          new ActionRowBuilder().addComponents(joueur),
          new ActionRowBuilder().addComponents(raison),
          new ActionRowBuilder().addComponents(preuve)
        );
      } else {
        const details = new TextInputBuilder()
          .setCustomId("ticket_details")
          .setLabel("Détails de la demande")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true);

        modal.addComponents(
          new ActionRowBuilder().addComponents(details)
        );
      }

      return interaction.showModal(modal);
    }

    // ───────────── MODAL → CRÉATION DU SALON DE TICKET ─────────────
    if (interaction.isModalSubmit() && interaction.customId.startsWith("ticket_form_")) {
      const type = interaction.customId.replace("ticket_form_", "");

      const categoryId = CATEGORY_IDS[type];
      if (!categoryId) {
        return interaction.reply({ content: "❌ Catégorie de ticket invalide.", ephemeral: true });
      }

      // Vérifier si un ticket existe déjà pour cet utilisateur
      const existing = interaction.guild.channels.cache.find(
        (c) =>
          c.type === ChannelType.GuildText &&
          c.name === `ticket-${interaction.user.id}`
      );

      if (existing) {
        return interaction.reply({
          content: "❌ Tu as déjà un ticket ouvert.",
          ephemeral: true
        });
      }

      let description = "";
      let fieldsText = "";

      if (type === "reportjoueur") {
        const joueur = interaction.fields.getTextInputValue("ticket_joueur");
        const raison = interaction.fields.getTextInputValue("ticket_raison");
        const preuve = interaction.fields.getTextInputValue("ticket_preuve") || "Aucune preuve fournie.";

        description =
          `**Type :** Report Joueur\n` +
          `**Joueur :** ${joueur}\n` +
          `**Raison :** ${raison}\n` +
          `**Preuve :** ${preuve}`;

        fieldsText = description;
      } else {
        const details = interaction.fields.getTextInputValue("ticket_details");
        description =
          `**Type :** ${type}\n` +
          `**Détails :**\n${details}`;
        fieldsText = description;
      }

      // Création du salon
      const channel = await interaction.guild.channels.create({
        name: `ticket-${interaction.user.id}`,
        type: ChannelType.GuildText,
        parent: categoryId,
        permissionOverwrites: [
          {
            id: interaction.guild.id,
            deny: [PermissionFlagsBits.ViewChannel]
          },
          {
            id: interaction.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory
            ]
          },
          {
            id: STAFF_ROLE,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory
            ]
          }
        ]
      });

      const embed = new EmbedBuilder()
        .setColor(THEME_COLOR)
        .setTitle("🟦 Bienvenue sur le support de Nancy RP 🟦")
        .setDescription(
          `${fieldsText}\n\n` +
          "Un membre du staff va bientôt te répondre.\n" +
          "Merci de rester courtois et de fournir toutes les informations nécessaires."
        )
        .setFooter({ text: "Nancy TICKET — Système de support" })
        .setTimestamp();

      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("btn_claim")
          .setLabel("Claim")
          .setStyle(ButtonStyle.Primary)
          .setEmoji("🧷"),
        new ButtonBuilder()
          .setCustomId("btn_lock")
          .setLabel("Lock")
          .setStyle(ButtonStyle.Secondary)
          .setEmoji("🔒"),
        new ButtonBuilder()
          .setCustomId("btn_call")
          .setLabel("Appel Staff")
          .setStyle(ButtonStyle.Success)
          .setEmoji("🔔"),
        new ButtonBuilder()
          .setCustomId("btn_close")
          .setLabel("Fermer")
          .setStyle(ButtonStyle.Danger)
          .setEmoji("🗑️")
      );

      await channel.send({
        content: `<@${interaction.user.id}> <@&${STAFF_ROLE}>`,
        embeds: [embed],
        components: [buttons]
      });

      return interaction.reply({
        content: `🎫 Ton ticket a été créé : ${channel}`,
        ephemeral: true
      });
    }

    // ───────────── BOUTONS DE GESTION DU TICKET ─────────────
    if (interaction.isButton()) {
      const { customId, channel, guild, user, member } = interaction;

      // Claim
      if (customId === "btn_claim") {
        if (!member.roles.cache.has(STAFF_ROLE)) {
          return interaction.reply({ content: "❌ Tu dois être staff pour claim ce ticket.", ephemeral: true });
        }

        return interaction.reply({
          content: `🧷 Ticket pris en charge par <@${user.id}>.`,
          ephemeral: false
        });
      }

      // Lock
      if (customId === "btn_lock") {
        if (!member.roles.cache.has(LOCK_ROLE) && !member.roles.cache.has(STAFF_ROLE)) {
          return interaction.reply({ content: "❌ Tu n'as pas la permission de lock ce ticket.", ephemeral: true });
        }

        const ticketOwnerId = channel.name.startsWith("ticket-")
          ? channel.name.replace("ticket-", "")
          : null;

        if (ticketOwnerId) {
          await channel.permissionOverwrites.edit(ticketOwnerId, {
            SendMessages: false
          });
        }

        return interaction.reply("🔒 Le ticket a été verrouillé pour l'utilisateur.");
      }

      // Appel Staff
      if (customId === "btn_call") {
        return interaction.reply({
          content: `<@&${STAFF_ROLE}> 🔔 Un staff est demandé sur ce ticket.`,
          ephemeral: false
        });
      }

      // Fermer → Confirmation
      if (customId === "btn_close") {
        if (!member.roles.cache.has(STAFF_ROLE)) {
          return interaction.reply({ content: "❌ Tu dois être staff pour fermer ce ticket.", ephemeral: true });
        }

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("confirm_close")
            .setLabel("Confirmer la fermeture")
            .setStyle(ButtonStyle.Danger)
            .setEmoji("⚠️"),
          new ButtonBuilder()
            .setCustomId("cancel_close")
            .setLabel("Annuler")
            .setStyle(ButtonStyle.Secondary)
            .setEmoji("❌")
        );

        return interaction.reply({
          content: "⚠️ Es-tu sûr de vouloir fermer ce ticket ?",
          components: [row]
        });
      }

      // Annuler fermeture
      if (customId === "cancel_close") {
        return interaction.update({
          content: "❌ Fermeture annulée.",
          components: []
        });
      }

      // Confirmer fermeture → transcript + logs + delete
      if (customId === "confirm_close") {
        await interaction.update({
          content: "🗑️ Fermeture du ticket dans 2 secondes…",
          components: []
        });

        const messages = await channel.messages.fetch({ limit: 100 });
        const transcript = messages
          .reverse()
          .map((m) => `${m.createdAt.toISOString()} | ${m.author.tag}: ${m.content}`)
          .join("\n");

        const fileName = `transcript-${channel.id}.txt`;
        fs.writeFileSync(fileName, transcript || "Aucun message dans ce ticket.");

        const logChannel = guild.channels.cache.get(LOG_CHANNEL);
        if (logChannel) {
          await logChannel.send({
            content: `📄 Transcript du ticket **${channel.name}**`,
            files: [fileName]
          });
        }

        setTimeout(() => {
          channel.delete().catch(() => {});
          fs.unlink(fileName, () => {});
        }, 2000);
      }
    }
  } catch (err) {
    console.error("Erreur interactionCreate :", err);
    if (interaction.isRepliable && !interaction.replied && !interaction.deferred) {
      interaction.reply({ content: "❌ Une erreur est survenue.", ephemeral: true }).catch(() => {});
    }
  }
});

// ─────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────

client.login(TOKEN).catch((err) => {
  console.error("Erreur de connexion :", err);
  process.exit(1);
});
