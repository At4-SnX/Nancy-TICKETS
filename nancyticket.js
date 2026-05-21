require("dotenv").config();
const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionsBitField, ButtonBuilder, ButtonStyle } = require("discord.js");

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers], partials: [Partials.Channel] });

const STAFF_ROLE = "1505943612507295826";
const LOCK_ROLE = "1505943624200884426";
const LOG_CHANNEL = "1506375933051932753";

// 1. COMMANDE DE PANNEAU
client.on("messageCreate", async (m) => {
    if (m.content === "!sendpanel" && m.member.permissions.has("Administrator")) {
        const menu = new StringSelectMenuBuilder().setCustomId("ticket_menu").setPlaceholder("Choisissez votre demande")
            .addOptions([
                { label: "❓ Question", value: "question" }, { label: "🛡️ Report Staff", value: "reportstaff" },
                { label: "⚠️ Report Joueur", value: "reportjoueur" }, { label: "📘 Demande Légal", value: "legal" }
            ]);
        await m.channel.send({ content: "🎫 **Centre d'assistance Nancy RP**", components: [new ActionRowBuilder().addComponents(menu)] });
    }
});

// 2. INTERACTONS
client.on("interactionCreate", async (i) => {
    // A. Formulaire d'ouverture
    if (i.isStringSelectMenu() && i.customId === "ticket_menu") {
        const modal = new ModalBuilder().setCustomId(`modal_${i.values[0]}`).setTitle("Formulaire de demande");
        modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("q1").setLabel("Expliquez votre demande").setStyle(TextInputStyle.Paragraph).setRequired(true)));
        await i.showModal(modal);
    }

    // B. Création du salon
    else if (i.isModalSubmit() && i.customId.startsWith("modal_")) {
        const type = i.customId.split("_")[1];
        const channel = await i.guild.channels.create({
            name: `🎫・${type}-${i.user.username}`,
            permissionOverwrites: [
                { id: i.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: i.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                { id: STAFF_ROLE, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
            ]
        });
        const menu = new StringSelectMenuBuilder().setCustomId("control").addOptions([
            { label: "🧷 Claim", value: "claim" }, { label: "🔒 Verrouiller", value: "lock" },
            { label: "➕ Ajouter Membre", value: "add" }, { label: "🗑️ Fermer", value: "close" }
        ]);
        await channel.send({ content: `<@&${STAFF_ROLE}>, nouveau ticket de ${i.user}`, components: [new ActionRowBuilder().addComponents(menu)] });
        await i.reply({ content: `Ticket créé : ${channel}`, ephemeral: true });
    }

    // C. Gestion Menu Staff
    else if (i.isStringSelectMenu() && i.customId === "control") {
        if (!i.member.roles.cache.has(STAFF_ROLE)) return i.reply({ ephemeral: true, content: "❌ Réservé au staff." });
        
        if (i.values[0] === "claim") await i.reply(`🧷 Pris en charge par ${i.user}`);
        else if (i.values[0] === "lock") {
            await i.channel.permissionOverwrites.edit(LOCK_ROLE, { SendMessages: false });
            await i.reply("🔒 Rôle verrouillé.");
        }
        else if (i.values[0] === "add") {
            const m = new ModalBuilder().setCustomId("m_add").setTitle("Ajout").addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("uid").setLabel("ID Membre").setStyle(TextInputStyle.Short)));
            await i.showModal(m);
        }
        else if (i.values[0] === "close") {
            const row = new ActionRowBuilder().addComponents([1,2,3,4,5].map(n => new ButtonBuilder().setCustomId(`rate_${n}`).setLabel(n.toString()).setStyle(ButtonStyle.Primary)));
            await i.guild.channels.cache.get(LOG_CHANNEL).send({ content: `Ticket fermé par ${i.user}. Notation :`, components: [row] });
            await i.reply("🗑️ Suppression...");
            setTimeout(() => i.channel.delete(), 2000);
        }
    }

    // D. Notation & Ajout
    else if (i.isButton() && i.customId.startsWith("rate_")) {
        await i.reply(`✅ Note enregistrée : ${i.customId.split("_")[1]}/5`);
    }
    else if (i.isModalSubmit() && i.customId === "m_add") {
        await i.channel.permissionOverwrites.edit(i.fields.getTextInputValue("uid"), { ViewChannel: true, SendMessages: true });
        await i.reply("➕ Membre ajouté.");
    }
});

client.login(process.env.TOKEN);