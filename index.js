const { 
    Client, 
    GatewayIntentBits, 
    REST, 
    Routes, 
    SlashCommandBuilder, 
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType
} = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');

// 1. إعداد الـ Client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// 2. إعداد Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

// 3. ملف الردود التلقائية
const DATA_FILE = './auto_responses.json';
let autoResponses = {};

if (fs.existsSync(DATA_FILE)) {
    try {
        autoResponses = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch (err) {
        console.error('خطأ في قراءة ملف الردود:', err);
    }
}

function saveResponses() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(autoResponses, null, 2));
    } catch (err) {
        console.error('خطأ في حفظ ملف الردود:', err);
    }
}

// قائمة أسئلة كت تويت والصورة الخضراء
const cutQuestions = [
    "أكلتك المفضلة اللي مستحيل تمل منها؟ 🍕",
    "شيء غريب تحبه ومحد يفهم شغفك فيه؟ 🤔",
    "لو أتيحت لك فرصة السفر الآن، ما هي وجهتك؟ ✈️",
    "شنو أكثر صفة تكرها في الأشخاص؟ ❌",
    "عادة يومية لو لم تفعلها ينظر يومك ناقص؟ ☕",
    "أفضل فيلم أو مسلسل شاهدته في حياتك؟ 🎬",
    "لو ترجع بالزمن لسنة واحدة، شنو التغيير اللي بتسويه؟ ⏳"
];
const CUT_IMAGE_URL = 'https://i.ibb.co/C03vR20/green-tox.png';

// 4. بناء أوامر السلاش
const commands = [
    new SlashCommandBuilder()
        .setName('كت')
        .setDescription('إرسال سؤال كت تويت عشوائي'),
    
    new SlashCommandBuilder()
        .setName('لوحة-التذاكر')
        .setDescription('إرسال لوحة فتح التذاكر (للمشرفين)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
        .setName('إضافة-رد')
        .setDescription('إضافة رد تلقائي جديد')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addStringOption(opt => opt.setName('الكلمة').setDescription('الكلمة').setRequired(true))
        .addStringOption(opt => opt.setName('الرد').setDescription('الرد').setRequired(true)),

    new SlashCommandBuilder()
        .setName('حذف-رد')
        .setDescription('حذف رد تلقائي')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addStringOption(opt => opt.setName('الكلمة').setDescription('الكلمة').setRequired(true)),

    new SlashCommandBuilder()
        .setName('الردود')
        .setDescription('عرض الردود التلقائية')
].map(cmd => cmd.toJSON());

// 5. عند تشغيل البوت
client.once('ready', async () => {
    console.log(`تم تسجيل الدخول بنجاح باسم: ${client.user.tag}`);

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('تم تسجيل وتأمين أوامر السلاش بنجاح!');
    } catch (error) {
        console.error('خطأ تسجيل الأوامر:', error);
    }
});

// دالة إنشاء إمبد الكت تويت
function createCutEmbed(user) {
    const randomQuestion = cutQuestions[Math.floor(Math.random() * cutQuestions.length)];
    const embed = new EmbedBuilder()
        .setColor('#57F287')
        .setTitle('📊 ✨ Cut Tweet | كت تويت')
        .setDescription(`### **📌 ${randomQuestion}**`)
        .setImage(CUT_IMAGE_URL)
        .setFooter({ text: `طلب بواسطة: ${user.username} • جاوب في الروم!`, iconURL: user.displayAvatarURL() })
        .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('next_cut_question')
            .setLabel('سؤال آخر 🎲')
            .setStyle(ButtonStyle.Success)
    );
    return { embeds: [embed], components: [row] };
}

// 6. التعامل مع التفاعلات (Slash Commands & Buttons)
client.on('interactionCreate', async interaction => {
    try {
        if (interaction.isChatInputCommand()) {
            const { commandName, options, user, channel } = interaction;

            if (commandName === 'كت') {
                await interaction.reply(createCutEmbed(user));
            }

            else if (commandName === 'لوحة-التذاكر') {
                const embed = new EmbedBuilder()
                    .setColor('#57F287')
                    .setTitle('🎫 نظام الدعم الفني والتذاكر')
                    .setDescription('إضغط على الزر أسفله لفتح تذكرة وسيتم التواصل معك من قبل فريق الدعم الفني.');

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('create_ticket')
                        .setLabel('فتح تذكرة 📩')
                        .setStyle(ButtonStyle.Success)
                );

                await channel.send({ embeds: [embed], components: [row] });
                await interaction.reply({ content: '✅ تم إرسال لوحة التذاكر بنجاح!', ephemeral: true });
            }

            else if (commandName === 'إضافة-رد') {
                const trigger = options.getString('الكلمة').toLowerCase();
                const response = options.getString('الرد');
                autoResponses[trigger] = response;
                saveResponses();
                await interaction.reply({ content: `✅ تم إضافة الرد للكلمة: **${trigger}**`, ephemeral: true });
            }

            else if (commandName === 'حذف-رد') {
                const trigger = options.getString('الكلمة').toLowerCase();
                if (autoResponses[trigger]) {
                    delete autoResponses[trigger];
                    saveResponses();
                    await interaction.reply({ content: `🗑️ تم حذف الرد للكلمة: **${trigger}**`, ephemeral: true });
                } else {
                    await interaction.reply({ content: `❌ الكلمة غير موجودة.`, ephemeral: true });
                }
            }

            else if (commandName === 'الردود') {
                const keys = Object.keys(autoResponses);
                if (keys.length === 0) return interaction.reply({ content: '📭 لا يوجد ردود مسجلة.', ephemeral: true });
                let listText = '📋 **الردود التلقائية:**\n\n' + keys.map((k, i) => `${i + 1}. **${k}** ➔ ${autoResponses[k]}`).join('\n');
                await interaction.reply({ content: listText, ephemeral: true });
            }
        }

        // الأزرار (Buttons)
        else if (interaction.isButton()) {
            const { customId, guild, user, channel } = interaction;

            if (customId === 'next_cut_question') {
                await interaction.update(createCutEmbed(user));
            }

            else if (customId === 'create_ticket') {
                const ticketChannelName = `ticket-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
                const existingChannel = guild.channels.cache.find(c => c.name === ticketChannelName);

                if (existingChannel) {
                    return interaction.reply({ content: `❌ لديك تذكرة مفتوحة بالفعل: ${existingChannel}`, ephemeral: true });
                }

                const ticketChannel = await guild.channels.create({
                    name: ticketChannelName,
                    type: ChannelType.GuildText,
                    permissionOverwrites: [
                        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                        { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
                    ]
                });

                const closeEmbed = new EmbedBuilder()
                    .setColor('#ED4245')
                    .setTitle(`مرحباً بك ${user.username}`)
                    .setDescription('اكتب مشكلتك أو استفسارك هنا وسيرد عليك الإدارة قريباً.\n\nاضغط الزر بالأسفل لإغلاق التذكرة.');

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('close_ticket')
                        .setLabel('إغلاق التذكرة 🔒')
                        .setStyle(ButtonStyle.Danger)
                );

                await ticketChannel.send({ embeds: [closeEmbed], components: [row] });
                await interaction.reply({ content: `✅ تم فتح تذكرتك: ${ticketChannel}`, ephemeral: true });
            }

            else if (customId === 'close_ticket') {
                await interaction.reply('🔒 جاري إغلاق التذكرة خلال 5 ثوانٍ...');
                setTimeout(() => channel.delete().catch(() => {}), 5000);
            }
        }
    } catch (err) {
        console.error('Interaction Error:', err);
    }
});

// 7. الاستماع للرسائل (الرد التلقائي + الذكاء الاصطناعي Gemini)
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    const content = message.content.toLowerCase().trim();

    // أولاً: فحص الردود التلقائية المحفوظة
    if (autoResponses[content]) {
        return message.reply(autoResponses[content]);
    }

    // ثانياً: شروط تفعيل الذكاء الاصطناعي
    const isMentioned = message.mentions.has(client.user);
    const isAiPrefix = content.startsWith('!ai');
    let isReplyToBot = false;

    if (message.reference && message.reference.messageId) {
        try {
            const referencedMsg = await message.channel.messages.fetch(message.reference.messageId);
            if (referencedMsg && referencedMsg.author.id === client.user.id) {
                isReplyToBot = true;
            }
        } catch (e) {
            // تجاهل خطأ جلب الرسالة القديمة
        }
    }

    if (isMentioned || isAiPrefix || isReplyToBot) {
        try {
            await message.channel.sendTyping();
            
            // تنظيف النص وضمان معالجة الـ Reply بدقة
            let cleanPrompt = message.content
                .replace(/<@!?\d+>/g, '')
                .replace(/^!ai/i, '')
                .trim();

            if (!cleanPrompt && message.content) {
                cleanPrompt = message.content.trim();
            }

            if (!cleanPrompt) return message.reply('نعم! كيف أستطيع مساعدتك؟');

            const result = await model.generateContent(cleanPrompt);
            const response = await result.response;
            const replyText = response.text() || 'عذراً، لم أستطع فهم ذلك.';
            
            // تقسيم الرد إذا كان أطول من حد ديسكورد (2000 حرف)
            if (replyText.length > 2000) {
                const chunks = replyText.match(/[\s\S]{1,1900}/g) || [];
                for (const chunk of chunks) {
                    await message.reply(chunk);
                }
            } else {
                await message.reply(replyText);
            }
        } catch (error) {
            console.error('Gemini AI Error:', error);
            message.reply('حدث خطأ أثناء التواصل مع الذكاء الاصطناعي.');
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
