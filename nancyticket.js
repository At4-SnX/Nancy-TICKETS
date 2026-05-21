require("dotenv").config();
const { 
    Client, GatewayIntentBits, Partials, ActionRowBuilder, 
    StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, 
    PermissionsBitField, EmbedBuilder 
} = require("discord.js");

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers], 
    partials: [Partials.Channel] 
});

const STAFF_ROLE = "1505943612507295826";
const LOCK_ROLE = "1505943624200884426";
const LOG_CHANNEL = "1506375933051932753";

// --- 1. MENU DÉROULANT SEUL ---
client.on("messageCreate", async (m) => {
    if (m.content === "!sendpanel" && m.member.permissions.has("Administrator")) {
        const menu = new StringSelectMenuBuilder().setCustomId("ticket_menu").setPlaceholder("📂 Sélectionnez une catégorie")
            .addOptions([
                { label: "Question", value: "question" },
                { label: "Partenariat", value: "partenariat" },
                { label: "Report Staff", value: "reportstaff" },
                { label: "Report Joueur", value: "reportjoueur" },
                { label: "Demande Légal", value: "legal" },
                { label: "Demande Illégal", value: "illegal" },
                { label: "Fondation", value: "fondation" }
            ]);
        await m.channel.send({ components: [new ActionRowBuilder().addComponents(menu)] });
        await m.delete();
    }
});

// --- 2. GESTION DES INTERACTIONS ---
client.on("interactionCreate", async (i) => {
    // Menu -> Formulaire
    if (i.isStringSelectMenu() && i.customId === "ticket_menu") {
        const modal = new ModalBuilder().setCustomId(`m_${i.values[0]}`).setTitle("Détails de votre demande");
        modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("d").setLabel("Expliquez votre problème").setStyle(TextInputStyle.Paragraph).setRequired(true)));
        await i.showModal(modal);
    }
    
    // Création salon + Transcript
    else if (i.isModalSubmit() && i.customId.startsWith("m_")) {
        const type = i.customId.split("_")[1];
        const channel = await i.guild.channels.create({
            name: `┃🎫・${type}-${i.user.username}`,
            permissionOverwrites: [
                { id: i.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: i.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                { id: STAFF_ROLE, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
            ]
        });

        const menu = new StringSelectMenuBuilder().setCustomId("ctrl").addOptions([
            { label: "Verrouiller", value: "lock" },
            { label: "Fermer le ticket", value: "close" }
        ]);

        await channel.send({ content: `<@&${STAFF_ROLE}>`, embeds: [new EmbedBuilder().setTitle("Détails du ticket").setDescription(i.fields.getTextInputValue("d")).setColor("#5865F2")], components: [new ActionRowBuilder().addComponents(menu)] });
        await i.reply({ content: `✅ Ticket ouvert : ${channel}`, ephemeral: true });
    }

    // Contrôle Ticket + Transcript
    else if (i.isStringSelectMenu() && i.customId === "ctrl") {
        if (!i.member.roles.cache.has(STAFF_ROLE)) return i.reply({ content: "❌ Accès refusé.", ephemeral: true });
        
        if (i.values[0] === "lock") {
            await i.channel.permissionOverwrites.edit(LOCK_ROLE, { SendMessages: false });
            await i.reply("🔒 Ticket verrouillé.");
        } else if (i.values[0] === "close") {
            const messages = await i.channel.messages.fetch({ limit: 100 });
            const transcript = messages.map(m => `[${m.author.tag}]: ${m.content}`).reverse().join("\n");
            
            await i.guild.channels.cache.get(LOG_CHANNEL).send({ 
                content: `📄 Transcript du ticket : ${i.channel.name}`, 
                files: [{ attachment: Buffer.from(transcript), name: "transcript.txt" }] 
            });
            await i.reply("🗑️ Fermeture...");
            setTimeout(() => i.channel.delete(), 2000);
        }
    }
});

client.login(process.env.TOKEN);