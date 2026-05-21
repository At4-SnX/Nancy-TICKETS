require("dotenv").config();
const { 
    Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, 
    StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, 
    ButtonBuilder, ButtonStyle, PermissionsBitField 
} = require("discord.js");

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers],
    partials: [Partials.Channel]
});

// --- CONFIGURATION ---
const PANEL_CHANNEL = "1505943795643060235";
const STAFF_ROLE = "1505943612507295826";
const LOG_CHANNEL = "1506375933051932753";

const config = {
    categories: {
        question: "1506374094906720387", partenariat: "1506374190956281997",
        reportstaff: "1506374327509979186", reportjoueur: "1506374389137149982",
        legal: "1505943608832819282", illegal: "1505943610141442129",
        fondation: "1506374573535268885", prioritaire: "1506374573535268885"
    }
};

client.on("ready", () => console.log(`✅ Nancy ASSISTANCE opérationnel !`));

client.on("interactionCreate", async interaction => {
    // 1. MENU SÉLECTION (Panneau d'accueil)
    if (interaction.isStringSelectMenu() && interaction.customId === "ticket_menu") {
        const modal = new ModalBuilder()
            .setCustomId(`modal_${interaction.values[0]}`)
            .setTitle(`Ticket : ${interaction.values[0]}`);
        
        modal.addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("details")
                .setLabel("Expliquez votre demande")
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
        ));
        await interaction.showModal(modal);
    }

    // 2. CRÉATION SALON (Soumission Modal)
    else if (interaction.isModalSubmit() && interaction.customId.startsWith("modal_")) {
        const type = interaction.customId.replace("modal_", "");
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

        const embed = new EmbedBuilder()
            .setTitle(`🎫 Support Nancy RP : ${type.toUpperCase()}`)
            .setDescription(`**Utilisateur :** ${interaction.user}\n**Demande :** ${details}\n\nUn staff arrivera sous peu.`)
            .setColor("#237FEB");

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("claim").setLabel("Claim").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId("add_user").setLabel("Ajouter").setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId("lock").setLabel("Verrouiller").setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId("close").setLabel("Fermer").setStyle(ButtonStyle.Danger)
        );

        await channel.send({ content: `${interaction.user} | <@&${STAFF_ROLE}>`, embeds: [embed], components: [row] });
        await interaction.reply({ content: `✅ Votre ticket : ${channel}`, ephemeral: true });
    }

    // 3. BOUTONS ACTION & MODAL NOTATION
    else if (interaction.isButton()) {
        const { customId, channel, member, guild } = interaction;
        if (!member.roles.cache.has(STAFF_ROLE) && customId !== "add_user_close") return interaction.reply({ content: "❌ Réservé au staff.", ephemeral: true });

        if (customId === "claim") await interaction.reply(`🧷 **Ticket pris en charge par :** ${member}`);
        else if (customId === "lock") {
            await channel.permissionOverwrites.edit(channel.permissionOverwrites.cache.find(p => p.id !== guild.id), { SendMessages: false });
            await interaction.reply("🔒 Ticket verrouillé.");
        }
        else if (customId === "add_user") {
            const modal = new ModalBuilder().setCustomId("add_user_modal").setTitle("Ajouter un membre");
            modal.addComponents(new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId("target_id").setLabel("ID du membre").setStyle(TextInputStyle.Short).setRequired(true)
            ));
            await interaction.showModal(modal);
        }
        else if (customId === "close") {
            const modal = new ModalBuilder().setCustomId("modal_rating").setTitle("Notation du Staff");
            modal.addComponents(new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId("rating").setLabel("Note du staff (1 à 5)").setStyle(TextInputStyle.Short).setRequired(true)
            ));
            await interaction.showModal(modal);
        }
    }

    // 4. MODALS AJOUT & NOTATION
    else if (interaction.isModalSubmit()) {
        if (interaction.customId === "add_user_modal") {
            const targetId = interaction.fields.getTextInputValue("target_id");
            await interaction.channel.permissionOverwrites.edit(targetId, { ViewChannel: true, SendMessages: true });
            await interaction.reply(`➕ <@${targetId}> ajouté.`);
        } 
        else if (interaction.customId === "modal_rating") {
            const rating = interaction.fields.getTextInputValue("rating");
            const channel = interaction.channel;
            const messages = await channel.messages.fetch({ limit: 100 });
            const transcript = messages.reverse().map(m => `[${m.author.tag}]: ${m.content}`).join("\n");
            
            const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL);
            if (logChannel) {
                await logChannel.send({
                    content: `📄 **Transcript :** ${channel.name}\n⭐ **Note Staff :** ${rating}/5`,
                    files: [{ attachment: Buffer.from(transcript), name: "transcript.txt" }]
                });
            }
            await interaction.reply("🗑️ Suppression dans 5s...");
            setTimeout(() => channel.delete().catch(() => {}), 5000);
        }
    }
});

client.on("messageCreate", async (message) => {
    // Commande : !sendpanel (à taper dans le salon voulu)
    if (message.content === "!sendpanel" && message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        
        const embed = new EmbedBuilder()
            .setTitle("🎫 Support Nancy RP")
            .setDescription("Bienvenue sur le support. Choisissez une catégorie pour ouvrir un ticket.")
            .setColor("#237FEB");

        const menu = new StringSelectMenuBuilder()
            .setCustomId("ticket_menu")
            .setPlaceholder("🔵 Choisissez une catégorie")
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

        const row = new ActionRowBuilder().addComponents(menu);

        await message.channel.send({ embeds: [embed], components: [row] });
        await message.delete(); // Supprime ton message de commande pour faire propre
    }
});

client.login(process.env.TOKEN);