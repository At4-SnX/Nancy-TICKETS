// --- CONFIGURATION ---
const STAFF_ROLE = "1505943612507295826";
const LOCK_ROLE = "1505943624200884426";
const LOG_CHANNEL = "1506375933051932753";

// Dictionnaire des catégories (Assure-toi que ces IDs sont bien ceux de CATÉGORIES sur Discord)
const CAT_IDS = {
    question: "1506374094906720387",
    partenariat: "1506374190956281997",
    reportstaff: "1506374327509979186",
    reportjoueur: "1506374389137149982",
    legal: "1505943608832819282",
    illegal: "1505943610141442129",
    fondation: "1506374573535268885",
    prioritaire: "1507131810713305139"
};

// --- COMMANDE DE PANNEAU ---
client.on("messageCreate", async (m) => {
    if (m.content === "!sendpanel" && m.member.permissions.has("Administrator")) {
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
                { label: "🚨 Demande Unban", value: "prioritaire" }
            ]);
        await m.channel.send({ 
            content: "🎫 **Centre d'assistance Nancy RP**", 
            components: [new ActionRowBuilder().addComponents(menu)] 
        });
        await m.delete();
    }
});

// --- LOGIQUE DE CRÉATION DANS LA BONNE CATÉGORIE ---
client.on("interactionCreate", async (i) => {
    if (!i.isModalSubmit() || !i.customId.startsWith("modal_")) return;

    const type = i.customId.split("_")[1];
    const categoryId = CAT_IDS[type]; // Récupère l'ID correspondant au choix

    const channel = await i.guild.channels.create({
        name: `🎫・${type}-${i.user.username}`,
        parent: categoryId, // <--- C'est ici que le ticket est rangé dans la catégorie
        permissionOverwrites: [
            { id: i.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
            { id: i.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
            { id: STAFF_ROLE, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
        ]
    });
    
    await i.reply({ content: `✅ Ticket créé : ${channel}`, ephemeral: true });
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
    else if (i.isStringSelectMenu() && i.customId === "ticket_control") {
        if (!i.member.roles.cache.has(STAFF_ROLE)) return i.reply({ ephemeral: true, content: "❌ Réservé aux staffs." });
        const val = i.values[0];

        if (val === "claim") await i.reply(`🧷 Pris en charge par ${i.user}`);
        else if (val === "lock") {
            await i.channel.permissionOverwrites.edit(LOCK_ROLE, { SendMessages: false });
            await i.reply("🔒 Le rôle cible ne peut plus écrire.");
        }
        else if (val === "add") {
            const m = new ModalBuilder().setCustomId("m_add").setTitle("Ajout membre").addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("uid").setLabel("ID Discord du membre").setStyle(TextInputStyle.Short).setRequired(true)));
            await i.showModal(m);
        }
        else if (val === "close") {
            const transcript = (await i.channel.messages.fetch({ limit: 100 })).map(m => `[${m.author.tag}]: ${m.content}`).reverse().join("\n");
            await i.guild.channels.cache.get(LOG_CHANNEL).send({ content: "📄 Transcript :", files: [{ attachment: Buffer.from(transcript), name: "transcript.txt" }] });
            
            // Boutons de notation séparés
            const row = new ActionRowBuilder().addComponents([1,2,3,4,5].map(n => new ButtonBuilder().setCustomId(`rate_${n}`).setLabel(n.toString()).setStyle(ButtonStyle.Primary)));
            await i.guild.channels.cache.get(LOG_CHANNEL).send({ content: "⭐ Veuillez noter la prise en charge :", components: [row] });
            
            await i.reply("🗑️ Suppression du salon dans 3 secondes...");
            setTimeout(() => i.channel.delete(), 3000);
        }
    }
 
});

// --- BLOC D'ENVOI DU TICKET (Message de bienvenue en Embed) ---

const embedBienvenue = new EmbedBuilder()
    .setColor("#5865F2")
    .setTitle("🟦 Bienvenue sur le support de Nancy RP 🟦")
    .setDescription(`
━━━━━━━━━━━━━━━━━━

💙 Merci d’avoir ouvert un ticket !

Un membre du staff prendra votre demande en charge dès que possible.

━━━━━━━━━━━━━━━━━━

**Détails de la demande :**
${details}`) // 'details' contient les informations du formulaire
    .setTimestamp();

// Envoi du message dans le salon
await channel.send({ 
    content: `${i.user} | <@&${STAFF_ROLE}>`,
    embeds: [embedBienvenue], 
    components: [btns] // Tes boutons de gestion (Claim, Lock, etc.)
});

client.login(process.env.TOKEN);