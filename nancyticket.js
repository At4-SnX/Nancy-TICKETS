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
// CONFIG
// ─────────────────────────────────────────────

const TOKEN = process.env.TOKEN;
if (!TOKEN) {
  console.error("❌ TOKEN manquant dans .env");
  process.exit(1);
}

const THEME_COLOR = "#5865F2";

const STAFF_ROLE = "1505943612507295826";
const LOCK_ROLE = "1505943624200884426";
const LOG_CHANNEL = "1506375933051932753";

// rôles de ping spéciaux
const PING_ROLES = {
  unban: "1506046900195950703",
  legal: "1505943608832819282",
  illegal: "1505943610141442129",
  reportstaff: "1505943608082174192",
  partenariat: "1506052987603390505",
  default: STAFF_ROLE
};

const CATEGORY_IDS = {
  question: "1506374094906720387",
  partenariat: "1506374190956281997",
  reportstaff: "1506374327509979186",
  reportjoueur: "1506374389137149982",
  legal: "1505943608832819282",
  illegal: "1505943610141442129",
  fondation: "1506374573535268885",
  unban: "1506374094906720387" // change si tu veux une autre catégorie
};

// noms FR pour les salons
const CATEGORY_LABELS_FR = {
  question: "Question",
  partenariat: "Partenariat",
  reportstaff: "Report-Staff",
  reportjoueur: "Report-Joueur",
  legal: "Demande-Légal",
  illegal: "Demande-Illégal",
  fondation: "Fondation",
  unban: "Demande-Unban"
};

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

client.once("ready", () => {
  console.log(`✅ Nancy TICKET connecté en tant que ${client.user.tag}`);
});

// ─────────────────────────────────────────────
// PANEL : !sendpanel (ADMIN) — MENU SEUL
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
// INTERACTIONS
// ─────────────────────────────────────────────

client.on("interactionCreate", async (interaction) => {
  try {

    // ───────── MENU PRINCIPAL → MODAL OU SOUS-MENU ─────────
    if (interaction.isStringSelectMenu() && interaction.customId === "ticket_menu") {
      const type = interaction.values[0];

      // ───────── REPORT STAFF : CHOIX DU STAFF À REPORTER ─────────
      if (type === "reportstaff") {

        // Mise à jour du cache pour récupérer TOUS les membres
        await interaction.guild.members.fetch();

        const staffMembers = interaction.guild.members.cache
          .filter(m => m.roles.cache.has(STAFF_ROLE) && !m.user.bot);

        if (!staffMembers.size) {
          const embed = new EmbedBuilder()
            .setColor(THEME_COLOR)
            .setDescription("❌ Aucun staff trouvé à reporter.");
          return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        const staffMenu = new StringSelectMenuBuilder()
          .setCustomId("select_report_staff")
          .setPlaceholder("🛡️ Quel staff veux-tu reporter ?")
          .addOptions(
            staffMembers.map(m => ({
              label: m.user.tag,
              value: m.id
            }))
          );

        const embed = new EmbedBuilder()
          .setColor(THEME_COLOR)
          .setDescription("🛡️ Sélectionne le membre du staff que tu souhaites reporter.");

        return interaction.reply({
          embeds: [embed],
          components: [new ActionRowBuilder().addComponents(staffMenu)],
          ephemeral: true
        });
      }

      // ───────── AUTRES TYPES : OUVERTURE DU MODAL DIRECT ─────────
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

    // ───────── SOUS-MENU : CHOIX DU STAFF À REPORTER ─────────
    if (interaction.isStringSelectMenu() && interaction.customId === "select_report_staff") {

      const staffId = interaction.values[0];

      const modal = new ModalBuilder()
        .setCustomId(`ticket_form_reportstaff_${staffId}`)
        .setTitle("🛡️ Report Staff");

      modal.addComponents(
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

      return interaction.showModal(modal);
    }

    // (le reste de ton code continue ici…)

  } catch (err) {
    console.error("Erreur interaction :", err);
  }
});

    // ───────── MODALS → CRÉATION DES TICKETS ─────────
    if (interaction.isModalSubmit() && interaction.customId.startsWith("ticket_form_")) {
      let type = interaction.customId.replace("ticket_form_", "");
      let reportedStaffId = null;

      // cas spécial reportstaff avec ID encodé
      if (type.startsWith("reportstaff_")) {
        reportedStaffId = type.split("_")[1];
        type = "reportstaff";
      }

      const categoryId = CATEGORY_IDS[type];
      if (!categoryId) {
        const embed = new EmbedBuilder()
          .setColor(THEME_COLOR)
          .setDescription("❌ Catégorie de ticket invalide.");
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      const existing = interaction.guild.channels.cache.find(
        c => c.name.includes(`-${interaction.user.username}`)
      );
      if (existing) {
        const embed = new EmbedBuilder()
          .setColor(THEME_COLOR)
          .setDescription("❌ Tu as déjà un ticket ouvert.");
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      let description;

      if (type === "reportjoueur") {
        description =
          `**Type : Report Joueur**\n` +
          `**Joueur :** ${interaction.fields.getTextInputValue("ticket_joueur")}\n` +
          `**Raison :** ${interaction.fields.getTextInputValue("ticket_raison")}\n` +
          `**Preuve :** ${interaction.fields.getTextInputValue("ticket_preuve") || "Aucune"}`;
      } else if (type === "unban") {
        description =
          `**Type : Demande d’unban**\n` +
          `**Nom :** ${interaction.fields.getTextInputValue("ticket_unban_nom")}\n` +
          `**Raison :** ${interaction.fields.getTextInputValue("ticket_unban_raison")}`;
      } else if (type === "reportstaff") {
        description =
          `**Type : Report Staff**\n` +
          `**Staff reporté :** <@${reportedStaffId}>\n` +
          `**Raison :** ${interaction.fields.getTextInputValue("ticket_raison")}\n` +
          `**Preuve :** ${interaction.fields.getTextInputValue("ticket_preuve") || "Aucune"}`;
      } else {
        description =
          `**Type : ${CATEGORY_LABELS_FR[type] || type}**\n` +
          `**Détails :**\n${interaction.fields.getTextInputValue("ticket_details")}`;
      }

      const overwrites = [
        { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
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
      ];

      // staff reporté explicitement exclu du ticket
      if (reportedStaffId) {
        overwrites.push({
          id: reportedStaffId,
          deny: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory
          ]
        });
      }

      const catLabel = CATEGORY_LABELS_FR[type] || type;
      const safeUser = interaction.user.username.replace(/[^a-zA-Z0-9-_]/g, "");
      const channelName = `・🎫・${catLabel}-${safeUser}`;

      const channel = await interaction.guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: categoryId,
        permissionOverwrites: overwrites
      });

      const embedTicket = new EmbedBuilder()
        .setColor(THEME_COLOR)
        .setTitle("🟦 Bienvenue sur le support de Nancy RP 🟦")
        .setDescription(description)
        .setFooter({ text: "Nancy TICKET — Support" })
        .setTimestamp();

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

      // rôle à ping selon le type
const pingRole =
  PING_ROLES[type] ? PING_ROLES[type] : PING_ROLES.default;

await channel.send({
  content: `<@&${pingRole}> <@${interaction.user.id}>`,
  embeds: [embedTicket],
  components: [new ActionRowBuilder().addComponents(controlMenu)]
});


      const embedReply = new EmbedBuilder()
        .setColor(THEME_COLOR)
        .setDescription(`🎫 Ton ticket a été créé : ${channel}`);
      return interaction.reply({ embeds: [embedReply], ephemeral: true });
    }

    // ───────── MENU DE CONTRÔLE DU TICKET ─────────
    if (interaction.isStringSelectMenu() && interaction.customId === "ticket_controls") {
      const action = interaction.values[0];
      const channel = interaction.channel;
      const member = interaction.member;

      // Claim
      if (action === "claim") {
        if (!member.roles.cache.has(STAFF_ROLE)) {
          const embed = new EmbedBuilder()
            .setColor(THEME_COLOR)
            .setDescription("❌ Tu n'es pas staff.");
          return interaction.reply({ embeds: [embed], ephemeral: true });
        }
        const embed = new EmbedBuilder()
          .setColor(THEME_COLOR)
          .setDescription(`🧷 Ticket pris en charge par <@${interaction.user.id}>.`);
        return interaction.reply({ embeds: [embed] });
      }

      // Lock
      if (action === "lock") {
        if (!member.roles.cache.has(LOCK_ROLE) && !member.roles.cache.has(STAFF_ROLE)) {
          const embed = new EmbedBuilder()
            .setColor(THEME_COLOR)
            .setDescription("❌ Tu n'as pas la permission de lock ce ticket.");
          return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // retrouver l'utilisateur via le nom du salon
        const parts = channel.name.split("-");
        const userName = parts.slice(1).join("-"); // après la catégorie
        const guildMember = channel.guild.members.cache.find(m => m.user.username.replace(/[^a-zA-Z0-9-_]/g, "") === userName);

        if (guildMember) {
          await channel.permissionOverwrites.edit(guildMember.id, { SendMessages: false });
        }

        const embed = new EmbedBuilder()
          .setColor(THEME_COLOR)
          .setDescription("🔒 Ticket verrouillé pour l'utilisateur.");
        return interaction.reply({ embeds: [embed] });
      }

      // Appel Staff
      if (action === "call") {
        const embed = new EmbedBuilder()
          .setColor(THEME_COLOR)
          .setDescription(`<@&${STAFF_ROLE}> 🔔 Un staff est demandé sur ce ticket.`);
        return interaction.reply({ embeds: [embed] });
      }

      // Ajouter un membre
      if (action === "adduser") {
        const modal = new ModalBuilder()
          .setCustomId("add_user_modal")
          .setTitle("➕ Ajouter un membre au ticket");

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
        if (!member.roles.cache.has(STAFF_ROLE)) {
          const embed = new EmbedBuilder()
            .setColor(THEME_COLOR)
            .setDescription("❌ Tu dois être staff pour fermer ce ticket.");
          return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("confirm_close")
            .setLabel("Confirmer")
            .setStyle(ButtonStyle.Danger)
            .setEmoji("⚠️"),
          new ButtonBuilder()
            .setCustomId("cancel_close")
            .setLabel("Annuler")
            .setStyle(ButtonStyle.Secondary)
            .setEmoji("❌")
        );

        const embed = new EmbedBuilder()
          .setColor(THEME_COLOR)
          .setDescription("⚠️ Es-tu sûr de vouloir fermer ce ticket ?");
        return interaction.reply({ embeds: [embed], components: [row] });
      }
    }

    // ───────── MODAL : AJOUT D’UN MEMBRE ─────────
    if (interaction.isModalSubmit() && interaction.customId === "add_user_modal") {
      const userId = interaction.fields.getTextInputValue("user_id");

      try {
        await interaction.channel.permissionOverwrites.edit(userId, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true
        });

        const embed = new EmbedBuilder()
          .setColor(THEME_COLOR)
          .setDescription(`➕ <@${userId}> a été ajouté au ticket.`);
        return interaction.reply({ embeds: [embed] });
      } catch {
        const embed = new EmbedBuilder()
          .setColor(THEME_COLOR)
          .setDescription("❌ ID invalide ou impossible à ajouter.");
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }
    }

    // ───────── BOUTONS : FERMETURE ─────────
    if (interaction.isButton()) {
      if (interaction.customId === "cancel_close") {
        const embed = new EmbedBuilder()
          .setColor(THEME_COLOR)
          .setDescription("❌ Fermeture annulée.");
        return interaction.update({ embeds: [embed], components: [] });
      }

      if (interaction.customId === "confirm_close") {
        const embedInfo = new EmbedBuilder()
          .setColor(THEME_COLOR)
          .setDescription("🗑️ Fermeture du ticket dans 2 secondes…");
        await interaction.update({ embeds: [embedInfo], components: [] });

        const messages = await interaction.channel.messages.fetch({ limit: 100 });
        const transcript = messages
          .reverse()
          .map(m => `${m.createdAt.toISOString()} | ${m.author.tag}: ${m.content}`)
          .join("\n");

        const fileName = `transcript-${interaction.channel.id}.txt`;
        fs.writeFileSync(fileName, transcript || "Aucun message dans ce ticket.");

        const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL);
        if (logChannel) {
          const embedLog = new EmbedBuilder()
            .setColor(THEME_COLOR)
            .setDescription(`📄 Transcript du ticket **${interaction.channel.name}**`);
          await logChannel.send({ embeds: [embedLog], files: [fileName] });
        }

        setTimeout(() => {
          interaction.channel.delete().catch(() => {});
          fs.unlink(fileName, () => {});
        }, 2000);
      }
    }
  } catch (err) {
    console.error("Erreur interaction :", err);
    if (interaction.isRepliable && !interaction.replied && !interaction.deferred) {
      const embed = new EmbedBuilder()
        .setColor(THEME_COLOR)
        .setDescription("❌ Une erreur est survenue.");
      interaction.reply({ embeds: [embed], ephemeral: true }).catch(() => {});
    }
  }
});

// ─────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────

client.login(TOKEN).catch(err => {
  console.error("Erreur de connexion :", err);
  process.exit(1);
});
