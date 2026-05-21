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

// Dictionnaire des catégories (ID des salons catégories)
const CAT_IDS = {
    question: "1506374094906720387",
    partenariat: "1506374190956281997",
    reportstaff: "1506374327509979186",
    reportjoueur: "1506374389137149982",
    legal: "1505943608832819282",
    illegal: "1505943610141442129",
    fondation: "1506374573535268885"
};

// --- PANNEAU SANS EMBED ---
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

// --- GESTION DES INTERACTIONS ---
client.on("interactionCreate", async (i) => {
    
    // A. Menu sélection -> Affiche le formulaire (Modal)
    if (i.isStringSelectMenu() && i.customId === "ticket_menu") {
        const modal = new ModalBuilder()
            .setCustomId(`m_${i.values[0]}`)
            .setTitle("OUVERTURE DE TICKET");
            
        modal.addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("d")
                .setLabel("Détaillez votre demande")
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
        ));
        await i.showModal(modal);
    }
    
    // B. Création du salon avec interface BOUTONS
    else if (i.isModalSubmit() && i.customId.startsWith("m_")) {
        const type = i.customId.split("_")[1];
        const categoryId = CAT_IDS[type];
        
        const channel = await i.guild.channels.create({
            name: `🎫・${type}-${i.user.username}`,
            parent: categoryId,
            permissionOverwrites: [
                { id: i.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: i.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                { id: STAFF_ROLE, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
            ]
        });

        // Boutons de gestion Staff
        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("btn_claim").setLabel("Prendre en charge").setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId("btn_lock").setLabel("Verrouiller").setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId("btn_call").setLabel("Appel Staff").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId("btn_close").setLabel("Fermer").setStyle(ButtonStyle.Danger)
        );

        const embed = new EmbedBuilder()
            .setTitle(`Support Nancy RP | ${type.toUpperCase()}`)
            .setColor("#2B2D31")
            .setDescription(`**Auteur :** ${i.user}\n**Message :**\n${i.fields.getTextInputValue("d")}`)
            .setTimestamp();

        await channel.send({ 
            content: `<@&${STAFF_ROLE}>`, 
            embeds: [embed], 
            components: [buttons] 
        });

        await i.reply({ content: `✅ Ton ticket a été ouvert : ${channel}`, ephemeral: true });
    }

// C. Gestion des Boutons de contrôle
    else if (i.isButton()) {
        // Seul le staff peut utiliser les boutons
        if (!i.member.roles.cache.has(STAFF_ROLE)) {
            return i.reply({ content: "❌ Seul le staff peut utiliser ces boutons.", ephemeral: true });
        }

        if (i.customId === "btn_claim") {
            await i.reply({ content: `🧷 Ce ticket est désormais pris en charge par ${i.user}.` });
            // On peut optionnellement changer la couleur de l'embed ici
        } 
        
        else if (i.customId === "btn_lock") {
            await i.channel.permissionOverwrites.edit(LOCK_ROLE, { SendMessages: false });
            await i.reply("🔒 Le ticket est désormais verrouillé pour l'utilisateur.");
        } 

        else if (i.customId === "btn_call") {
            await i.reply({ content: `🔔 <@&${STAFF_ROLE}>, une assistance supplémentaire est demandée dans ce ticket !` });
        }

        else if (i.customId === "btn_close") {
            // Transcript
            const messages = await i.channel.messages.fetch({ limit: 100 });
            const transcript = messages.map(m => `[${m.author.tag}]: ${m.content}`).reverse().join("\n");
            
            const logChannel = i.guild.channels.cache.get(LOG_CHANNEL);
            if (logChannel) {
                await logChannel.send({ 
                    content: `📄 **Transcript Ticket :** \`${i.channel.name}\` fermé par ${i.user}`, 
                    files: [{ attachment: Buffer.from(transcript), name: `transcript-${i.channel.name}.txt` }] 
                });
            }

            await i.reply("🗑️ Le ticket sera supprimé dans quelques secondes...");
            setTimeout(() => i.channel.delete().catch(() => {}), 5000);
        }
    }
}); // Fermeture du interactionCreate

client.login(process.env.TOKEN);