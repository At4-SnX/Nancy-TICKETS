require("dotenv").config();
const { 
    Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, 
    StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, 
    PermissionsBitField 
} = require("discord.js");

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers], 
    partials: [Partials.Channel] 
});

const STAFF_ROLE = "1505943612507295826";
const LOCK_ROLE = "1505943624200884426";
const LOG_CHANNEL = "1506375933051932753";

// --- 1. PANNEAU ESTHÉTIQUE ---
client.on("messageCreate", async (m) => {
    if (m.content === "!sendpanel" && m.member.permissions.has("Administrator")) {
        const embed = new EmbedBuilder()
            .setTitle("🎫 Centre d'Assistance - Nancy RP")
            .setDescription("Bienvenue au support. Sélectionnez une catégorie ci-dessous pour ouvrir un ticket.")
            .setColor("#2B2D31") // Couleur sombre élégante
            .setFooter({ text: "Nancy RP Support", iconURL: m.guild.iconURL() });

        const menu = new StringSelectMenuBuilder().setCustomId("ticket_menu").setPlaceholder("📂 Choisissez une catégorie")
            .addOptions([
                { label: "❓ Question", value: "question", emoji: "❓" },
                { label: "🛡️ Report Staff", value: "reportstaff", emoji: "🛡️" },
                { label: "⚠️ Report Joueur", value: "reportjoueur", emoji: "⚠️" },
                { label: "📘 Demande Légal", value: "legal", emoji: "📘" }
            ]);
        await m.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] });
        await m.delete();
    }
});

// --- 2. LOGIQUE D'INTERACTION ---
client.on("interactionCreate", async (i) => {
    // Menu -> Formulaire
    if (i.isStringSelectMenu() && i.customId === "ticket_menu") {
        const modal = new ModalBuilder().setCustomId(`m_${i.values[0]}`).setTitle("Détails de votre ticket");
        modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("d").setLabel("Expliquez votre problème").setStyle(TextInputStyle.Paragraph).setRequired(true)));
        await i.showModal(modal);
    }
    
    // Création salon
    else if (i.isModalSubmit() && i.customId.startsWith("m_")) {
        const type = i.customId.split("_")[1];
        const channel = await i.guild.channels.create({
            name: `🎫・${i.user.username}`,
            permissionOverwrites: [
                { id: i.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: i.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                { id: STAFF_ROLE, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
            ]
        });

        const embed = new EmbedBuilder()
            .setTitle(`Ticket : ${type.toUpperCase()}`)
            .setDescription(`**Utilisateur :** ${i.user}\n**Détails :** ${i.fields.getTextInputValue("d")}`)
            .setColor("#5865F2");

        const menu = new StringSelectMenuBuilder().setCustomId("ctrl").addOptions([
            { label: "🔒 Verrouiller", value: "lock" },
            { label: "➕ Ajouter Membre", value: "add" },
            { label: "🗑️ Fermer le ticket", value: "close" }
        ]);

        await channel.send({ content: `<@&${STAFF_ROLE}>`, embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] });
        await i.reply({ content: `✅ Ticket ouvert : ${channel}`, ephemeral: true });
    }

    // Contrôle Ticket
    else if (i.isStringSelectMenu() && i.customId === "ctrl") {
        if (!i.member.roles.cache.has(STAFF_ROLE)) return i.reply({ content: "❌ Accès refusé.", ephemeral: true });
        
        if (i.values[0] === "lock") {
            await i.channel.permissionOverwrites.edit(LOCK_ROLE, { SendMessages: false });
            await i.reply("🔒 Ticket verrouillé.");
        } else if (i.values[0] === "close") {
            await i.reply("🗑️ Suppression...");
            setTimeout(() => i.channel.delete(), 2000);
        }
    }
});

client.login(process.env.TOKEN);