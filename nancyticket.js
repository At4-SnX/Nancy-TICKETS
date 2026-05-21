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

// --- CONFIGURATION ---
const STAFF_ROLE = "1505943612507295826";
const LOCK_ROLE = "1505943624200884426";
const LOG_CHANNEL = "1506375933051932753";

const config = {
    categories: {
        question: "1506374094906720387", partenariat: "1506374190956281997",
        reportstaff: "1506374327509979186", reportjoueur: "1506374389137149982",
        legal: "1505943608832819282", illegal: "1505943610141442129",
        fondation: "1506374573535268885", prioritaire: "1506374573535268885"
    }
};

// --- PANNEAU D'ACCUEIL ---
client.on("messageCreate", async (message) => {
    if (message.content === "!sendpanel" && message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        const menu = new StringSelectMenuBuilder().setCustomId("ticket_menu").setPlaceholder("🔵 Cliquez ici pour ouvrir un ticket").addOptions([
            { label: "❓ Question", value: "question" }, { label: "🤝 Partenariat", value: "partenariat" },
            { label: "🛡️ Report Staff", value: "reportstaff" }, { label: "⚠️ Report Joueur", value: "reportjoueur" },
            { label: "📘 Demande Légal", value: "legal" }, { label: "📕 Demande Illégal", value: "illegal" },
            { label: "🏛️ Fondation", value: "fondation" }, { label: "🚨 Prioritaire", value: "prioritaire" }
        ]);
        await message.channel.send({ content: "🎫 **Support Nancy RP** - Choisissez une catégorie :", components: [new ActionRowBuilder().addComponents(menu)] });
        await message.delete();
    }
});

// --- GESTION INTERACTIONS ---
client.on("interactionCreate", async (interaction) => {
    // 1. Menu sélection -> Formulaire
    if (interaction.isStringSelectMenu() && interaction.customId === "ticket_menu") {
        const modal = new ModalBuilder().setCustomId(`modal_${interaction.values[0]}`).setTitle("Détails de la demande");
        modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("d1").setLabel("Expliquez votre demande").setStyle(TextInputStyle.Paragraph).setRequired(true)));
        await interaction.showModal(modal);
    }
    // 2. Création du salon
    else if (interaction.isModalSubmit() && interaction.customId.startsWith("modal_")) {
        const type = interaction.customId.split("_")[1];
        const detail = interaction.fields.getTextInputValue("d1");
        const channel = await interaction.guild.channels.create({
            name: `🎫・${type}-${interaction.user.username}`,
            parent: config.categories[type],
            permissionOverwrites: [
                { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                { id: STAFF_ROLE, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
            ]
        });
        const menu = new StringSelectMenuBuilder().setCustomId("ticket_control").addOptions([
            { label: "🧷 Claim", value: "claim" }, { label: "🔒 Verrouiller", value: "lock" },
            { label: "➕ Ajouter membre", value: "add" }, { label: "🗑️ Fermer", value: "close" }
        ]);
        await channel.send({ content: `${interaction.user} | <@&${STAFF_ROLE}>`, embeds: [new EmbedBuilder().setDescription(detail).setColor("#237FEB")], components: [new ActionRowBuilder().addComponents(menu)] });
        await interaction.reply({ content: `✅ Ticket : ${channel}`, ephemeral: true });
    }
    // 3. Contrôle ticket
    else if (interaction.isStringSelectMenu() && interaction.customId === "ticket_control") {
        if (!interaction.member.roles.cache.has(STAFF_ROLE)) return interaction.reply({ ephemeral: true, content: "❌" });
        const val = interaction.values[0];
        if (val === "claim") await interaction.reply(`🧷 Pris en charge par ${interaction.user}`);
        else if (val === "lock") { await interaction.channel.permissionOverwrites.edit(LOCK_ROLE, { SendMessages: false }); await interaction.reply("🔒 Verrouillé."); }
        else if (val === "add") { const m = new ModalBuilder().setCustomId("m_add").setTitle("ID").addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("id").setLabel("ID").setStyle(TextInputStyle.Short))); await interaction.showModal(m); }
        else if (val === "close") {
            const transcript = (await interaction.channel.messages.fetch({ limit: 100 })).map(m => `[${m.author.tag}]: ${m.content}`).reverse().join("\n");
            await interaction.guild.channels.cache.get(LOG_CHANNEL).send({ content: "📄 Transcript :", files: [{ attachment: Buffer.from(transcript), name: "transcript.txt" }] });
            await interaction.reply("🗑️ Fermé. Note (1-5) :");
            const collector = interaction.channel.createMessageCollector({ time: 15000, max: 1 });
            collector.on('collect', async (m) => { await interaction.guild.channels.cache.get(LOG_CHANNEL).send(`⭐ Note : ${m.content}/5`); setTimeout(() => interaction.channel.delete(), 2000); });
        }
    }
    // 4. Ajout membre
    else if (interaction.isModalSubmit() && interaction.customId === "m_add") {
        await interaction.channel.permissionOverwrites.edit(interaction.fields.getTextInputValue("id"), { ViewChannel: true, SendMessages: true });
        await interaction.reply("➕ Ajouté.");
    }
});

client.login(process.env.TOKEN);