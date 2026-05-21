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

const STAFF_ROLE = "1505943612507295826"; // Rôle Staff à ping
const LOCK_ROLE = "1505943624200884426";  // Rôle à verrouiller
const LOG_CHANNEL = "1506375933051932753";

const config = {
    categories: {
        question: "1506374094906720387", partenariat: "1506374190956281997",
        reportstaff: "1506374327509979186", reportjoueur: "1506374389137149982",
        legal: "1505943608832819282", illegal: "1505943610141442129",
        fondation: "1506374573535268885", prioritaire: "1506374573535268885"
    }
};

// --- Panneau !sendpanel ---
client.on("messageCreate", async (message) => {
    if (message.content === "!sendpanel" && message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        const menu = new StringSelectMenuBuilder()
            .setCustomId("ticket_menu")
            .setPlaceholder("🔵 Cliquez ici pour ouvrir un ticket")
            .addOptions([
                { label: "❓ Question", value: "question" },
                { label: "🤝 Partenariat", value: "partenariat" },
                { label: "🛡️ Report Staff", value: "reportstaff" },
                { label: "⚠️ Report Joueur", value: "reportjoueur" },
                { label: "📘 Demande Légal", value: "legal" },
                { label: "📕 Demande Illégal", value: "illegal" },
                { label: "🏛️ Fondation", value: "fondation" },
                { label: "🚨 Prioritaire", value: "prioritaire" }
            ]);
        await message.channel.send({ content: "🎫 **Support Nancy RP** - Choisissez une catégorie :", components: [new ActionRowBuilder().addComponents(menu)] });
    }
});

client.on("interactionCreate", async (interaction) => {
    // Menu Création
    if (interaction.isStringSelectMenu() && interaction.customId === "ticket_menu") {
        const modal = new ModalBuilder().setCustomId(`modal_${interaction.values[0]}`).setTitle("Détails du ticket");
        modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("details").setLabel("Expliquez votre demande").setStyle(TextInputStyle.Paragraph).setRequired(true)));
        await interaction.showModal(modal);
    }
    // Création salon
    else if (interaction.isModalSubmit() && interaction.customId.startsWith("modal_")) {
        const type = interaction.customId.split("_")[1];
        const details = interaction.fields.getTextInputValue("details");
        const channel = await interaction.guild.channels.create({
            name: `🎫・${type}-${interaction.user.username}`,
            parent: config.categories[type],
            permissionOverwrites: [
                { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                { id: STAFF_ROLE, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
            ]
        });

        // Ping Staff + Menu de contrôle
        const controlMenu = new StringSelectMenuBuilder().setCustomId("ticket_control").setPlaceholder("⚙️ Gérer le ticket").addOptions([
            { label: "🧷 Prendre en charge (Claim)", value: "claim" },
            { label: "🔒 Verrouiller le ticket", value: "lock" },
            { label: "🗑️ Fermer et Noter", value: "close" }
        ]);
        
        await channel.send({ 
            content: `${interaction.user} | <@&${STAFF_ROLE}>, un nouveau ticket a été ouvert.`, 
            embeds: [new EmbedBuilder().setTitle("Ticket ouvert").setDescription(details).setColor("#237FEB")], 
            components: [new ActionRowBuilder().addComponents(controlMenu)] 
        });
        await interaction.reply({ content: `✅ Ticket créé : ${channel}`, ephemeral: true });
    }
    // Menu Contrôle
    else if (interaction.isStringSelectMenu() && interaction.customId === "ticket_control") {
        const action = interaction.values[0];
        if (!interaction.member.roles.cache.has(STAFF_ROLE)) return interaction.reply({ content: "❌ Staff uniquement.", ephemeral: true });

        if (action === "claim") await interaction.reply(`🧷 Pris en charge par ${interaction.user}`);
        else if (action === "lock") {
            // Verrouille spécifiquement le rôle demandé
            await interaction.channel.permissionOverwrites.edit(LOCK_ROLE, { SendMessages: false });
            await interaction.reply("🔒 Le rôle cible a été empêché d'écrire.");
        }
        else if (action === "close") {
            const modal = new ModalBuilder().setCustomId("modal_rating").setTitle("Notation Staff");
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("rating").setLabel("Note sur 5").setStyle(TextInputStyle.Short).setRequired(true)));
            await interaction.showModal(modal);
        }
    }
    // Notation et fermeture
    else if (interaction.isModalSubmit() && interaction.customId === "modal_rating") {
        const rating = interaction.fields.getTextInputValue("rating");
        const messages = await interaction.channel.messages.fetch({ limit: 100 });
        const transcript = messages.map(m => `[${m.author.tag}]: ${m.content}`).reverse().join("\n");
        const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL);
        if (logChannel) await logChannel.send({ content: `📄 **Transcript**\n⭐ **Note Staff :** ${rating}/5`, files: [{ attachment: Buffer.from(transcript), name: "transcript.txt" }] });
        await interaction.reply("🗑️ Suppression...");
        setTimeout(() => interaction.channel.delete(), 3000);
    }
});

client.login(process.env.TOKEN);