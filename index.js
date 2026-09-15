require('dotenv').config();
const { 
    Client, 
    GatewayIntentBits, 
    Events, 
    REST, 
    Routes, 
    SlashCommandBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ChannelType, 
    PermissionFlagsBits,
    EmbedBuilder 
} = require('discord.js');
const { GoogleGenAI } = require('@google/genai');

// ==========================================
// ⚙️ المتغيرات والإعدادات (ضع الـ IDs الخاصة بك)
// ==========================================
const ADMIN_ROLE_ID = 'ضع_هنا_ID_رتبة_الادارة';
const LOG_CHANNEL_ID = 'ضع_هنا_ID_قناة_اللوق'; 
const WELCOME_CHANNEL_ID = 'ضع_هنا_ID_قناة_الترحيب';
const AUTO_ROLE_ID = 'ضع_هنا_ID_رتبة_العضو_التلقائية';

const WELCOME_GIF_URL = 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3ZudnA3dmN3amJtcXZndnIxejU5ZHdocmN3ZnR5eXZxbHZib3Y0YiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/mCbUi0fyYh3G2YL9Oi/giphy.gif';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// ==========================================
// ✂️ أسئلة ودالة Cut Tweet
// ==========================================
const cutQuestions = [
    "شيء لو اختفى من حياتك تتغير للأفضل؟ 🍃",
    "شنو أكثر صفة تحبها بشخصيتك وتكرهها بنفس الوقت؟ 🎭",
    "لو أتيحت لك فرصة تغير اسمك، شنو تختار؟ 🏷️",
    "صفة مستحيل تتقبلها بأي شخص؟ 🚫",
    "أخير شخص كلمته بالخاص، شنو آخر كلمة قلتها له؟ 📱",
    "شيء سويته بطفولتك وما زلت مستحي منه؟ 😅",
    "لو يعطونك مليون دولار بشرط تبعد عن التكنولوجيا شهر، توافق؟ 💰",
    "كلمة حاب تقولها للشخص اللي ببالك حالياً؟ 💭",
    "شنو الشيء اللي يحسن مزاجك فوراً لما تكون متضايق؟ ✨",
    "أفضل عادة تسويها بيومك؟ ☀️",
    "شنو أكبر حلم حققته لغاية اليوم؟ 🏆",
    "لو ترجع بالزمن سنة ورى، شنو الشيء اللي بتغيره؟ ⏳",
    "شخص بالسيرفر تستانس لما تشوفه متواجد؟ 👤",
    "أكثر قرار اتخذته بحياتك وكان صحيح 100%؟ 🎯",
    "أكلتك المفضلة اللي مستحيل تمل منها؟ 🍕"
];

function createCutMessage(user) {
    const randomQuestion = cutQuestions[Math.floor(Math.random() * cutQuestions.length)];

    const cutEmbed = new EmbedBuilder()
        .setAuthor({ name: '✨ Cut Tweet | كت تويت', iconURL: 'https://cdn-icons-png.flaticon.com/512/3408/3408591.png' })
        .setTitle(`📌 **${randomQuestion}**`)
        .setColor('#8A2BE2')
        .setImage('https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOHJmYzRnbmx6ZmdzcDRhOHFlYXlmcmluNmVsNTRvOWpwcWtlNmR3OCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3o7TKSjRrfIPjeiVyM/giphy.gif')
        .setFooter({ text: `طلب بواسطة: ${user.username} • جاوب في الروم!`, iconURL: user.displayAvatarURL({ dynamic: true }) })
        .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('next_cut_question')
            .setLabel('سؤال آخر 🎲')
            .setStyle(ButtonStyle.Primary)
    );

    return { embeds: [cutEmbed], components: [row] };
}

// ==========================================
// 📜 تسجيل أوامر السلاش (Slash Commands)
// ==========================================
const commands = [
    new SlashCommandBuilder()
        .setName('say')
        .setDescription('إرسال رسالة من خلال البوت')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option => 
            option.setName('message')
                .setDescription('الرسالة التي تريد إرسالها')
                .setRequired(true)),
    new SlashCommandBuilder()
        .setName('setup-ticket')
        .setDescription('إرسال لوحة فتح التذاكر في القناة الحالية')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

client.once(Events.ClientReady, async c => {
    console.log(`✅ تم تسجيل الدخول بنجاح باسم: ${c.user.tag}`);
    try {
        await rest.put(Routes.applicationCommands(c.user.id), { body: commands });
        console.log('✅ تم تسجيل وتأمين أوامر السلاش بنجاح!');
    } catch (error) {
        console.error('❌ خطأ في تسجيل أوامر السلاش:', error);
    }
});

// ==========================================
// 1️⃣ الترحيب وإعطاء الرتبة التلقائية
// ==========================================
client.on(Events.GuildMemberAdd, async member => {
    try {
        const autoRole = member.guild.roles.cache.get(AUTO_ROLE_ID);
        if (autoRole) await member.roles.add(autoRole);
    } catch (err) {
        console.error('❌ تعذر إعطاء الرتبة التلقائية:', err);
    }

    const welcomeChannel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
    if (!welcomeChannel) return;

    const welcomeEmbed = new EmbedBuilder()
        .setTitle(`🔥 أهلاً بك في ${member.guild.name}!`)
        .setDescription(`أهلاً وسهلاً بك يا ${member}! نورت السيرفر وانضمامك يسعدنا جداً 🚀`)
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
        .addFields(
            { name: '👤 العضو رقم:', value: `**#${member.guild.memberCount}**`, inline: true },
            { name: '📜 القوانين:', value: 'يرجى الاطلاع على القوانين لتجنب العقوبات.', inline: true }
        )
        .setColor('#5865F2')
        .setImage(WELCOME_GIF_URL)
        .setFooter({ text: 'نتمنى لك وقتاً ممتعاً معنا!', iconURL: member.guild.iconURL() })
        .setTimestamp();

    await welcomeChannel.send({ content: `👋 مرحباً بك ${member}!`, embeds: [welcomeEmbed] });
});

// ==========================================
// 2️⃣ التفاعل مع أوامر السلاش والأزرار
// ==========================================
client.on(Events.InteractionCreate, async interaction => {
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'say') {
            const textToSay = interaction.options.getString('message');
            await interaction.reply({ content: '👌 تم إرسال الرسالة بنجاح!', ephemeral: true });
            await interaction.channel.send(textToSay);
        }

        if (interaction.commandName === 'setup-ticket') {
            const embedPanel = new EmbedBuilder()
                .setTitle('🎫 مركز الدعم الفني والتذاكر')
                .setDescription('إذا كان لديك أي استفسار أو مشكلة، يرجى فتح تذكرة بالضغط على الزر أسفله.')
                .addFields(
                    { name: '⏰ أوقات العمل', value: 'فريق الدعم متواجد لخدمتكم على مدار الساعة.', inline: false },
                    { name: '⚠️ تنبيه مهم', value: 'يرجى عدم فتح التذاكر العشوائية لتجنب العقوبات.', inline: false }
                )
                .setColor('#2b2d31')
                .setFooter({ text: `${interaction.guild.name} • Support System`, iconURL: interaction.guild.iconURL() })
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('create_ticket')
                    .setLabel('فتح تذكرة')
                    .setEmoji('📩')
                    .setStyle(ButtonStyle.Primary)
            );

            await interaction.reply({ content: '✅ تم إنشاء لوحة التذاكر بنجاح!', ephemeral: true });
            await interaction.channel.send({ embeds: [embedPanel], components: [row] });
        }
    }

    if (interaction.isButton()) {
        if (interaction.customId === 'next_cut_question') {
            const newMessage = createCutMessage(interaction.user);
            await interaction.reply(newMessage);
        }

        if (interaction.customId === 'create_ticket') {
            const ticketName = `ticket-${interaction.user.username}`;
            const existingChannel = interaction.guild.channels.cache.find(c => c.name === ticketName.toLowerCase());
            if (existingChannel) {
                return interaction.reply({ content: `❌ لديك تذكرة مفتوحة بالفعل: ${existingChannel}`, ephemeral: true });
            }

            const ticketChannel = await interaction.guild.channels.create({
                name: ticketName,
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] },
                    { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
                ],
            });

            const ticketEmbed = new EmbedBuilder()
                .setTitle(`مرحباً بك في تذكرتك، ${interaction.user.username}!`)
                .setDescription('يرجى شرح مشكلتك بالتفصيل وسيقوم أحد المسؤولين بالرد عليك قريباً.')
                .setColor('#57f287')
                .setTimestamp();

            const closeRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('close_ticket')
                    .setLabel('إغلاق التذكرة')
                    .setEmoji('🔒')
                    .setStyle(ButtonStyle.Danger)
            );

            await ticketChannel.send({ content: `${interaction.user} | <@&${ADMIN_ROLE_ID}>`, embeds: [ticketEmbed], components: [closeRow] });
            await interaction.reply({ content: `✅ تم إنشاء تذكرتك بنجاح: ${ticketChannel}`, ephemeral: true });

            const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
            if (logChannel) {
                const openLogEmbed = new EmbedBuilder()
                    .setTitle('🟢 تم فتح تذكرة جديدة')
                    .addFields(
                        { name: '👤 صاحب التذكرة:', value: `${interaction.user} (${interaction.user.id})`, inline: true },
                        { name: '📌 القناة:', value: `${ticketChannel.name}`, inline: true }
                    )
                    .setColor('#57f287')
                    .setTimestamp();
                logChannel.send({ embeds: [openLogEmbed] });
            }
        }

        if (interaction.customId === 'close_ticket') {
            const closeEmbed = new EmbedBuilder()
                .setTitle('🔒 إغلاق التذكرة')
                .setDescription('سيتم حذف القناة وإغلاق التذكرة خلال **5 ثوانٍ**...')
                .setColor('#ed4245');

            await interaction.reply({ embeds: [closeEmbed] });

            const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
            if (logChannel) {
                const closeLogEmbed = new EmbedBuilder()
                    .setTitle('🔴 تم إغلاق تذكرة')
                    .addFields(
                        { name: '📌 التذكرة المغلقة:', value: `${interaction.channel.name}`, inline: true },
                        { name: '🛡️ تم الإغلاق بواسطة:', value: `${interaction.user} (${interaction.user.id})`, inline: true }
                    )
                    .setColor('#ed4245')
                    .setTimestamp();
                logChannel.send({ embeds: [closeLogEmbed] });
            }

            setTimeout(() => { interaction.channel.delete().catch(console.error); }, 5000);
        }
    }
});

// ==========================================
// 3️⃣ الأوامر العادية + AI
// ==========================================
const chatSessions = new Map();

client.on(Events.MessageCreate, async message => {
    if (message.author.bot || !message.guild) return;

    // ✂️ أمر كت تويت
    if (message.content === '!cut' || message.content === '!كت') {
        const cutMessage = createCutMessage(message.author);
        return message.channel.send(cutMessage);
    }

    // 🚀 أمر الطرد (+تف)
    if (message.content.startsWith('+تف')) {
        if (!message.member.permissions.has(PermissionFlagsBits.KickMembers)) {
            return message.reply('❌ ليس لديك صلاحية طرد الأعضاء!');
        }
        const targetMember = message.mentions.members.first();
        if (!targetMember) return message.reply('❌ يرجى تحديد الشخص المراد طرده عبر المنشن!');
        try {
            await targetMember.kick();
            message.reply(`🚀 تم طرد ${targetMember.user.tag} بنجاح!`);
        } catch (err) {
            console.error(err);
            message.reply('❌ تعذر طرد العضو، تأكد من صلاحيات البوت ورتبته!');
        }
    }

    // 🔄 أمر مسح ذاكرة AI
    if (message.content === '!reset') {
        chatSessions.delete(message.channel.id);
        return message.reply('🔄 تم مسح ذاكرة المحادثة لهذه القناة بنجاح!');
    }

    // 🤖 أمر الذكاء الاصطناعي (!ai)
    if (message.content.startsWith('!ai')) {
        const prompt = message.content.slice(3).trim();
        const imageAttachment = message.attachments.find(att => att.contentType?.startsWith('image/'));
        if (!prompt && !imageAttachment) return message.reply('❌ اكتب سؤالك أو أرفق صورة بعد الأمر!');

        await message.channel.sendTyping();

        const primaryModel = 'gemini-3.6-flash';
        const fallbackModel = 'gemini-3.6-flash-lite';
        
        const channelId = message.channel.id;
        const userName = message.author.displayName || message.author.username;

        let responseText = '';

        try {
            if (imageAttachment) {
                const imageResponse = await fetch(imageAttachment.url);
                const arrayBuffer = await imageResponse.arrayBuffer();
                const imageBuffer = Buffer.from(arrayBuffer);

                const res = await ai.models.generateContent({
                    model: primaryModel,
                    contents: [
                        prompt || "اشرح لي هذه الصورة",
                        { inlineData: { data: imageBuffer.toString("base64"), mimeType: imageAttachment.contentType } }
                    ]
                });
                responseText = res.text;
            } else {
                if (!chatSessions.has(channelId)) {
                    const newChat = ai.chats.create({
                        model: primaryModel,
                        config: { systemInstruction: `أنت مساعد ذكي ولطيف في سيرفر ديسكورد. تتحدث مع المستخدم "${userName}".` }
                    });
                    chatSessions.set(channelId, newChat);
                }
                const chat = chatSessions.get(channelId);
                const res = await chat.sendMessage({ message: prompt });
                responseText = res.text;
            }
        } catch (primaryErr) {
            console.warn('⚠️ جاري المحاولة بالنموذج الاحتياطي:', primaryErr.message);
            try {
                const fallbackRes = await ai.models.generateContent({
                    model: fallbackModel,
                    contents: prompt || "مرحبا"
                });
                responseText = fallbackRes.text;
            } catch (fallbackErr) {
                console.error('❌ خطأ في النظام:', fallbackErr);
                return message.reply('⏳ تم تجاوز حد الطلبات اليومي، يرجى استخراج API Key جديد وتحديثه في ملف `.env`.');
            }
        }

        const replyText = responseText.length > 1900 ? responseText.substring(0, 1900) + '...' : responseText;
        message.reply(replyText);
    }
});

client.login(process.env.DISCORD_TOKEN);