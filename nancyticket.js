require("dotenv").config();
const { 
    Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, 
    StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, 
    PermissionsBitField, ButtonBuilder, ButtonStyle 
} = require("discord.js");

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers], 
    partials: [Partials.Channel] 
});

// --- CONFIGURATION ---
const STAFF_ROLE = "1505943612507295826";
const LOCK_ROLE = "1505943624200884426"; // Le rôle qui sera bloqué
const LOG_CHANNEL = "1506375933051932753";

// --- COMMANDE DE PANNEAU (!sendpanel) ---
client.on("messageCreate", async (m) => {
    if (m.content === "!sendpanel" && m.member.permissions.has("Administrator")) {
        const menu = new StringSelectMenuBuilder()
            .setCustomId("ticket_menu")
            .setPlaceholder("🔵 Cliquez ici pour ouvrir une demande")
            .addOptions([
                { label: "❓ Question", value: "question" },
                { label: "🛡️ Report Staff", value: "reportstaff" },
                { label: "⚠️ Report Joueur", value: "reportjoueur" },
                { label: "📘 Demande Légal", value: "legal" },
                { label: "📕 Demande Illégal", value: "illegal" },
                { label: "🏛️ Fondation", value: "fondation" }
            ]);
        await m.channel.send({ 
            content: "🎫 **Centre d'assistance Nancy RP**\nChoisissez la catégorie correspondant à votre demande :", 
            components: [new ActionRowBuilder().addComponents(menu)] 
        });
        await m.delete();
    }
});

// --- FONCTION FORMULAIRE ---
function getModal(type) {
    const modal = new ModalBuilder().setCustomId(`modal_${type}`).setTitle("Formulaire : " + type.toUpperCase());
    
    if (type === "reportjoueur") {
        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("q1").setLabel("Nom du joueur accusé").setStyle(TextInputStyle.Short).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("q2").setLabel("Raison précise").setStyle(TextInputStyle.Paragraph).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("q3").setLabel("Preuve (Lien)").setStyle(TextInputStyle.Short).setRequired(true))
        );
    } else {
        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("q1").setLabel("Détails de votre demande").setStyle(TextInputStyle.Paragraph).setRequired(true))
        );
    }
    return modal;
}

// --- GESTION DES INTERACTIONS ---
client.on("interactionCreate", async (i) => {
    // 1. Menu sélection -> Affiche le formulaire
    if (i.isStringSelectMenu() && i.customId === "ticket_menu") await i.showModal(getModal(i.values[0]));

    // 2. Soumission formulaire -> Création salon
    else if (i.isModalSubmit() && i.customId.startsWith("modal_")) {
        const type = i.customId.split("_")[1];
        const details = i.fields.getTextInputValue("q1");
        
        const channel = await i.guild.channels.create({
            name: `🎫・${type}-${i.user.username}`,
            permissionOverwrites: [
                { id: i.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: i.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                { id: STAFF_ROLE, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
            ]
        });

        const menu = new StringSelectMenuBuilder().setCustomId("ticket_control").addOptions([
            { label: "🧷 Prendre en charge", value: "claim" },
            { label: "🔒 Verrouiller (Lock)", value: "lock" },
            { label: "➕ Ajouter un membre", value: "add" },
            { label: "🗑️ Fermer le ticket", value: "close" }
        ]);

        await channel.send({ 
            content: `<@&${STAFF_ROLE}>, nouveau ticket de ${i.user}`, 
            embeds: [new EmbedBuilder().setTitle("Détails").setDescription(details).setColor("#237FEB")],
            components: [new ActionRowBuilder().addComponents(menu)] 
        });
        await i.reply({ content: `✅ Ticket créé : ${channel}`, ephemeral: true });
    }

    // 3. Menu contrôle Staff
// 3. Menu contrôle Staff
    else if (i.isStringSelectMenu() && i.customId === "ticket_control") {
        if (!i.member.roles.cache.has(STAFF_ROLE)) return i.reply({ ephemeral: true, content: "❌ Réservé aux staffs." });
        const val = i.values[0];

        if (val === "claim") {
            await i.reply(`🧷 Pris en charge par ${i.user}`);
        } 
        else if (val === "lock") {
            await i.channel.permissionOverwrites.edit(LOCK_ROLE, { SendMessages: false });
            await i.reply("🔒 Le rôle cible ne peut plus écrire.");
        } 
        else if (val === "add") {
            const m = new ModalBuilder()
                .setCustomId("m_add")
                .setTitle("Ajout membre")
                .addComponents(new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId("uid").setLabel("ID Discord du membre").setStyle(TextInputStyle.Short).setRequired(true)
                ));
            await i.showModal(m);
        } 
        else if (val === "close") {
            const members = await i.channel.members.fetch();
            const userToRate = members.find(m => !m.user.bot && m.id !== i.user.id);

            if (userToRate) {
                try {
                    const row = new ActionRowBuilder().addComponents([1, 2, 3, 4, 5].map(n => 
                        new ButtonBuilder().setCustomId(`rate_${n}`).setLabel(n.toString()).setStyle(ButtonStyle.Primary)
                    ));
                    await userToRate.send({ 
                        content: `🎫 Votre ticket chez **Nancy RP** a été fermé. Veuillez noter la prise en charge :`, 
                        components: [row] 
                    });
                } catch (err) {
                    await i.channel.send("⚠️ Impossible d'envoyer le MP (MP fermés).");
                }
            }

            const transcript = (await i.channel.messages.fetch({ limit: 100 })).map(m => `[${m.author.tag}]: ${m.content}`).reverse().join("\n");
            await i.guild.channels.cache.get(LOG_CHANNEL).send({ content: "📄 Transcript :", files: [{ attachment: Buffer.from(transcript), name: "transcript.txt" }] });
            
            await i.reply("🗑️ Suppression du salon dans 3 secondes...");
            setTimeout(() => i.channel.delete(), 3000);
        } 
    }
    // 4. Action Ajout membre & Notation
    else if (i.isModalSubmit() && i.customId === "m_add") {
        await i.channel.permissionOverwrites.edit(i.fields.getTextInputValue("uid"), { ViewChannel: true, SendMessages: true });
        await i.reply("➕ Membre ajouté au ticket.");
    }
    else if (i.isButton() && i.customId.startsWith("rate_")) {
        await i.update({ content: `✅ Note enregistrée : ${i.customId.split("_")[1]}/5`, components: [] });
    }
});

client.login(process.env.TOKEN);
