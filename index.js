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
const Groq = require('groq-sdk');
const fs = require('fs');

// 1. إعداد الـ Client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// 2. إعداد Groq AI
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

// الذاكرات المؤقتة
const conversationHistory = new Map();
const processedMessages = new Set();
const activeGames = new Map(); 

// تنظيف ذاكرة AI كل ساعة
setInterval(() => {
    if (conversationHistory.size > 50) {
        conversationHistory.clear();
        console.log('🧹 تم تنظيف ذاكرة المحادثات المؤقتة.');
    }
}, 3600000);

// 3. إدارة الملفات المحلية
const DATA_FILE = './auto_responses.json';
const LEVELS_FILE = './levels.json';

let autoResponses = {};
let userLevels = {};

if (fs.existsSync(DATA_FILE)) {
    try { autoResponses = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch (e) {}
}
if (fs.existsSync(LEVELS_FILE)) {
    try { userLevels = JSON.parse(fs.readFileSync(LEVELS_FILE, 'utf8')); } catch (e) {}
}

function saveResponses() {
    fs.writeFileSync(DATA_FILE, JSON.stringify(autoResponses, null, 2));
}
function saveLevels() {
    fs.writeFileSync(LEVELS_FILE, JSON.stringify(userLevels, null, 2));
}

// قائمة أسئلة كت تويت مع الرابط الجديد المباشر والصحيح
const cutQuestions = [
    "أكلتك المفضلة اللي مستحيل تمل منها؟ 🍕",
    "شيء غريب تحبه ومحد يفهم شغفك فيه؟ 🤔",
    "لو أتيحت لك فرصة السفر الآن، ما هي وجهتك؟ ✈️",
    "شنو أكثر صفة تكرها في الأشخاص؟ ❌",
    "عادة يومية لو لم تفعلها ينظر يومك ناقص؟ ☕",
    "أفضل فيلم أو مسلسل شاهدته في حياتك؟ 🎬",
    "لو ترجع بالزمن لسنة واحدة، شنو التغيير اللي بتسويه؟ ⏳"
];
const CUT_IMAGE_URL = 'https://cdn.discordapp.com/attachments/1549253652789600297/1549395347531497533/extracted_embed_image.png?ex=6aaa8a5d&is=6aa938dd&hm=868fa29caefde283aac731f124aa541b76c644ad28e84a5c3944369edf9d86f5&';

const SYSTEM_PROMPT = {
    role: 'system',
    content: 'أنت بوت شات ذكي ورهيب في ديسكورد. تفهم جميع اللهجات العربية (الشامية، الأردنية، الخليجية، والمصرية) والاختصارات بذكاء. رد بنفس لهجة العضو بشكل عصري، ودي، ومختصر دون الحاجة لتصحيح المفردات.'
};

// 4. بناء الأوامر الأساسية (Slash Commands)
const commands = [
    new SlashCommandBuilder().setName('مساعدة').setDescription('عرض قائمة جميع أوامر ومميزات البوت'),
    new SlashCommandBuilder().setName('كت').setDescription('إرسال سؤال كت تويت عشوائي مع الصورة المخصصة'),
    new SlashCommandBuilder().setName('لوحة-التذاكر').setDescription('إرسال لوحة فتح التذاكر (للمشرفين)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder().setName('إضافة-رد').setDescription('إضافة رد تلقائي جديد')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addStringOption(opt => opt.setName('الكلمة').setDescription('الكلمة').setRequired(true))
        .addStringOption(opt => opt.setName('الرد').setDescription('الرد').setRequired(true)),
    new SlashCommandBuilder().setName('حذف-رد').setDescription('حذف رد تلقائي')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addStringOption(opt => opt.setName('الكلمة').setDescription('الكلمة').setRequired(true)),
    new SlashCommandBuilder().setName('الردود').setDescription('عرض الردود التلقائية'),
    new SlashCommandBuilder().setName('مستواي').setDescription('عرض مستواك ونقاط خبرتك في السيرفر'),
    new SlashCommandBuilder().setName('تخمين').setDescription('لعبة تخمين رقم عشوائي من 1 إلى 50'),
    new SlashCommandBuilder().setName('حجرة-ورقة-قلم').setDescription('لعب حجرة ورقة قلم ضد البوت')
        .addStringOption(opt => opt.setName('الخيار').setDescription('اختر لعبتك')
            .setRequired(true)
            .addChoices(
                { name: '🪨 حجرة', value: 'حجرة' },
                { name: '📄 ورقة', value: 'ورقة' },
                { name: '✂️ قلم (مقص)', value: 'قلم' }
            )),
    new SlashCommandBuilder().setName('اقترح').setDescription('إرسال اقتراح لتطوير السيرفر')
        .addStringOption(opt => opt.setName('الاقتراح').setDescription('اكتب اقتراحك هنا').setRequired(true)),
    new SlashCommandBuilder().setName('سيرفر').setDescription('عرض معلومات وإحصائيات السيرفر'),
    new SlashCommandBuilder().setName('حسابي').setDescription('عرض تفاصيل حسابك بالديسكورد'),
    new SlashCommandBuilder().setName('مزاج').setDescription('رادار البوت لتحليل المزاج العام والنشاط في السيرفر')
].map(cmd => cmd.toJSON());

// 5. تشغيل البوت
client.once('ready', async () => {
    console.log(`✅ تم تسجيل الدخول بنجاح باسم: ${client.user.tag}`);
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('🚀 تم تسجيل وتأمين جميع أوامر السلاش بنجاح!');
    } catch (error) {
        console.error('❌ خطأ تسجيل الأوامر:', error);
    }
});

// دالة إنشاء إمبد الكت تويت مع الصورة الجديدة
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
        new ButtonBuilder().setCustomId('next_cut_question').setLabel('سؤال آخر 🎲').setStyle(ButtonStyle.Success)
    );
    return { embeds: [embed], components: [row] };
}

client.on('guildMemberAdd', async member => {
    try {
        const welcomeChannel = member.guild.channels.cache.find(ch => ch.name.includes('welcome') || ch.name.includes('ترحيب')) || 
                               member.guild.channels.cache.find(ch => ch.type === ChannelType.GuildText && ch.permissionsFor(member.guild.members.me).has(PermissionFlagsBits.SendMessages));
        if (!welcomeChannel) return;

        const embed = new EmbedBuilder()
            .setColor('#57F287')
            .setTitle(`✨ أهلاً بك في سيرفر ${member.guild.name}!`)
            .setDescription(`مرحباً بك ${member}! نورت السيرفر 🥳\nنتمنى لك وقتاً ممتعاً معنا.`)
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
            .setFooter({ text: `أنت العضو رقم #${member.guild.memberCount}` })
            .setTimestamp();

        await welcomeChannel.send({ embeds: [embed] });
    } catch (e) {}
});

client.on('interactionCreate', async interaction => {
    try {
        if (interaction.isChatInputCommand()) {
            const { commandName, options, user, guild, channel } = interaction;

            if (commandName === 'مساعدة') {
                const helpEmbed = new EmbedBuilder()
                    .setColor('#57F287')
                    .setTitle('🌟 قائمة أوامر البوت والاختصارات')
                    .setDescription('مرحباً بك! إليك جميع الأوامر واختصارات الـ (+):')
                    .addFields(
                        { name: '⚡ اختصارات الـ Prefix السريعة', value: '`+كت` - سؤال كت تويت (مع صورتك الفخمة الجديدة)\n`+اقتراح [نص]` - إرسال اقتراح\n`+م [العدد]` - مسح الرسائل (إدارة)\n`+بند` - حظر عضو (إدارة)\n`+تف` - طرد عضو (إدارة)\n`+تايم` - تايم أوت لعضو (إدارة)', inline: false },
                        { name: '🤖 الذكاء الاصطناعي والمزاج', value: 'تحدث معي بمنشني أو بكلمة `يا بوت`. استخدم `/مزاج` لرؤية حالة السيرفر!', inline: false },
                        { name: '🎮 التسلية والألعاب', value: '`/كت` - سؤال كت تويت\n`/تخمين` - لعبة الأرقام\n`/حجرة-ورقة-قلم` - تحدى البوت', inline: false },
                        { name: '📊 المستويات والمعلومات', value: '`/مستواي` - مستواك\n`/سيرفر` - معلومات السيرفر\n`/حسابي` - حسابك', inline: false }
                    )
                    .setThumbnail(client.user.displayAvatarURL())
                    .setTimestamp();
                await interaction.reply({ embeds: [helpEmbed] });
            }

            else if (commandName === 'مزاج') {
                const moods = ['روقان وفايقين ☕', 'حماسي وولعة 🔥', 'رايقين وهادئين 🌙', 'سوالف وضحك 😂'];
                const currentMood = moods[Math.floor(Math.random() * moods.length)];
                const embed = new EmbedBuilder()
                    .setColor('#F1C40F')
                    .setTitle('🌡️ رادار مزاج السيرفر الذكي')
                    .setDescription(`بناءً على تحليل آخر الرسائل والتفاعل بالرومات، مزاج السيرفر حالياً:\n\n### **✨ ${currentMood} ✨**`)
                    .setFooter({ text: `طلب بواسطة ${user.username}` })
                    .setTimestamp();
                await interaction.reply({ embeds: [embed] });
            }

            else if (commandName === 'كت') await interaction.reply(createCutEmbed(user));

            else if (commandName === 'لوحة-التذاكر') {
                const embed = new EmbedBuilder()
                    .setColor('#57F287')
                    .setTitle('🎫 نظام الدعم الفني والتذاكر')
                    .setDescription('إضغط على الزر أسفله لفتح تذكرة.');
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('create_ticket').setLabel('فتح تذكرة 📩').setStyle(ButtonStyle.Success)
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

            else if (commandName === 'مستواي') {
                const data = userLevels[user.id] || { xp: 0, level: 1 };
                const embed = new EmbedBuilder()
                    .setColor('#57F287')
                    .setTitle(`📊 بطاقة مستوى: ${user.username}`)
                    .addFields(
                        { name: 'المستوى (Level)', value: `⭐ ${data.level}`, inline: true },
                        { name: 'نقاط الخبرة (XP)', value: `✨ ${data.xp} / ${data.level * 100}`, inline: true }
                    )
                    .setThumbnail(user.displayAvatarURL());
                await interaction.reply({ embeds: [embed] });
            }

            else if (commandName === 'تخمين') {
                const targetNum = Math.floor(Math.random() * 50) + 1;
                activeGames.set(channel.id, targetNum);
                await interaction.reply(`🎮 **بدأت لعبة التخمين!** اخترت رقماً بين **1 و 50**. اكتبه بالشات!`);
            }

            else if (commandName === 'حجرة-ورقة-قلم') {
                const userChoice = options.getString('الخيار');
                const choices = ['حجرة', 'ورقة', 'قلم'];
                const botChoice = choices[Math.floor(Math.random() * choices.length)];
                let result = '';
                if (userChoice === botChoice) result = 'تعادل! 🤝';
                else if (
                    (userChoice === 'حجرة' && botChoice === 'قلم') ||
                    (userChoice === 'ورقة' && botChoice === 'حجرة') ||
                    (userChoice === 'قلم' && botChoice === 'ورقة')
                ) result = 'فزت أنت! 🎉';
                else result = 'فاز البوت! 🤖';
                await interaction.reply(`اختيارك: **${userChoice}** | اختيار البوت: **${botChoice}**\n النتيجة: **${result}**`);
            }

            else if (commandName === 'اقترح') {
                const text = options.getString('الاقتراح');
                const sugChannel = guild.channels.cache.find(ch => ch.name.includes('اقتراحات') || ch.name.includes('suggestions')) || channel;
                const embed = new EmbedBuilder()
                    .setColor('#F1C40F')
                    .setTitle('💡 اقتراح جديد')
                    .setDescription(text)
                    .setFooter({ text: `صاحب الاقتراح: ${user.username}`, iconURL: user.displayAvatarURL() })
                    .setTimestamp();
                const msg = await sugChannel.send({ embeds: [embed] });
                await msg.react('👍');
                await msg.react('👎');
                await interaction.reply({ content: '✅ تم إرسال اقتراحك بنجاح!', ephemeral: true });
            }

            else if (commandName === 'سيرفر') {
                const embed = new EmbedBuilder()
                    .setColor('#57F287')
                    .setTitle(`🏰 معلومات سيرفر: ${guild.name}`)
                    .addFields(
                        { name: '👥 عدد الأعضاء', value: `${guild.memberCount}`, inline: true },
                        { name: '💬 عدد الرومات', value: `${guild.channels.cache.size}`, inline: true },
                        { name: '👑 صاحب السيرفر', value: `<@${guild.ownerId}>`, inline: true }
                    )
                    .setThumbnail(guild.iconURL())
                    .setTimestamp();
                await interaction.reply({ embeds: [embed] });
            }

            else if (commandName === 'حسابي') {
                const embed = new EmbedBuilder()
                    .setColor('#57F287')
                    .setTitle(`👤 حساب: ${user.username}`)
                    .addFields(
                        { name: '🆔 ID الحساب', value: user.id, inline: true },
                        { name: '📅 تاريخ إنشاء الحساب', value: `<t:${Math.floor(user.createdAt / 1000)}:R>`, inline: true }
                    )
                    .setThumbnail(user.displayAvatarURL());
                await interaction.reply({ embeds: [embed] });
            }
        }

        else if (interaction.isButton()) {
            const { customId, guild, user, channel } = interaction;
            if (customId === 'next_cut_question') await interaction.update(createCutEmbed(user));
            else if (customId === 'create_ticket') {
                const ticketChannelName = `ticket-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
                const existingChannel = guild.channels.cache.find(c => c.name === ticketChannelName);
                if (existingChannel) return interaction.reply({ content: `❌ لديك تذكرة مفتوحة بالفعل: ${existingChannel}`, ephemeral: true });

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
                    .setDescription('اكتب مشكلتك هنا. اضغط الزر بالأسفل للإغلاق.');
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('close_ticket').setLabel('إغلاق التذكرة 🔒').setStyle(ButtonStyle.Danger)
                );
                await ticketChannel.send({ embeds: [closeEmbed], components: [row] });
                await interaction.reply({ content: `✅ تم فتح تذكرتك: ${ticketChannel}`, ephemeral: true });
            } else if (customId === 'close_ticket') {
                await interaction.reply('🔒 جاري إغلاق التذكرة خلال 5 ثوانٍ...');
                setTimeout(() => channel.delete().catch(() => {}), 5000);
            }
        }
    } catch (err) {}
});

// 6. الاستماع للرسائل والاختصارات (+كت، +اقتراح، +م، +بند، +تف، +تايم)
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    if (processedMessages.has(message.id)) return;
    processedMessages.add(message.id);
    setTimeout(() => processedMessages.delete(message.id), 10000);

    const userId = message.author.id;
    const channelId = message.channel.id;
    const content = message.content.trim();
    const lowerContent = content.toLowerCase();

    // 1. اختصار (+كت) مع صورتك الجديدة
    if (lowerContent === '+كت') {
        return message.channel.send(createCutEmbed(message.author));
    }

    // 2. اختصار (+اقتراح [النص])
    if (lowerContent.startsWith('+اقتراح ')) {
        const suggestionText = content.slice(8).trim();
        if (!suggestionText) return message.reply('❌ لطفاً اكتب الاقتراح بعد الأمر. مثال: `+اقتراح افتحوا روم ميمز`');
        
        const sugChannel = message.guild.channels.cache.find(ch => ch.name.includes('اقتراحات') || ch.name.includes('suggestions')) || message.channel;
        const embed = new EmbedBuilder()
            .setColor('#F1C40F')
            .setTitle('💡 اقتراح جديد')
            .setDescription(suggestionText)
            .setFooter({ text: `صاحب الاقتراح: ${message.author.username}`, iconURL: message.author.displayAvatarURL() })
            .setTimestamp();
        
        const msg = await sugChannel.send({ embeds: [embed] });
        await msg.react('👍');
        await msg.react('👎');
        return message.reply({ content: '✅ تم إرسال اقتراحك بنجاح!' });
    }

    // 3. اختصار مسح الرسائل (+م [العدد])
    if (lowerContent.startsWith('+م ')) {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return message.reply('❌ ليس لديك صلاحية لإدارة الرسائل (`Manage Messages`)!');
        }
        const args = content.split(' ');
        const count = parseInt(args[1]);
        if (isNaN(count) || count < 1 || count > 100) {
            return message.reply('❌ لطفاً حدد رقماً صحيحاً بين 1 و 100. مثال: `+م 10`');
        }
        try {
            await message.delete().catch(() => {});
            const deleted = await message.channel.bulkDelete(count, true);
            const reply = await message.channel.send(`✅ تم مسح **${deleted.size}** رسالة بنجاح!`);
            setTimeout(() => reply.delete().catch(() => {}), 3000);
        } catch (e) {
            message.reply('❌ حدث خطأ، لا يمكنني مسح رسائل أقدم من 14 يوماً.');
        }
        return;
    }

    // 4. اختصار الباند (+بند [@عضو])
    if (lowerContent.startsWith('+بند')) {
        if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
            return message.reply('❌ ليس لديك صلاحية حظر الأعضاء (`Ban Members`)!');
        }
        const target = message.mentions.members.first();
        if (!target) return message.reply('❌ يرجى منشن العضو المراد حظره. مثال: `+بند @user`');
        if (!target.bannable) return message.reply('❌ لا يمكنني حظر هذا العضو، رتبته أعلى مني أو هو صاحب السيرفر!');

        await target.ban({ reason: `بواسطة ${message.author.tag}` }).catch(() => {});
        return message.reply(`🔨 تم حظر العضو **${target.user.tag}** بنجاح!`);
    }

    // 5. اختصار الطرد / التف (+تف [@عضو])
    if (lowerContent.startsWith('+تف')) {
        if (!message.member.permissions.has(PermissionFlagsBits.KickMembers)) {
            return message.reply('❌ ليس لديك صلاحية طرد الأعضاء (`Kick Members`)!');
        }
        const target = message.mentions.members.first();
        if (!target) return message.reply('❌ يرجى منشن العضو المراد طرده. مثال: `+تف @user`');
        if (!target.kickable) return message.reply('❌ لا يمكنني طرد هذا العضو!');

        await target.kick(`بواسطة ${message.author.tag}`).catch(() => {});
        return message.reply(`👢 تم طرد العضو **${target.user.tag}** من السيرفر!`);
    }

    // 6. اختصار التايم أوت (+تايم [@عضو] [الدقائق])
    if (lowerContent.startsWith('+تايم')) {
        if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            return message.reply('❌ ليس لديك صلاحية إسكات الأعضاء (`Timeout`)!');
        }
        const args = content.split(' ');
        const target = message.mentions.members.first();
        const minutes = parseInt(args[2]);

        if (!target || isNaN(minutes)) {
            return message.reply('❌ الطريقة الصحيحة: `+تايم @عضو [عدد الدقائق]` (مثال: `+تايم @user 5`)');
        }

        try {
            await target.timeout(minutes * 60 * 1000, `بواسطة ${message.author.tag}`);
            return message.reply(`🔇 تم إعطاء تايم أوت للعضو **${target.user.tag}** لمدة **${minutes}** دقيقة!`);
        } catch (e) {
            return message.reply('❌ فشل إعطاء تايم أوت، تأكد من صلاحيات البوت.');
        }
    }

    // نظام XP والمستويات
    if (!userLevels[userId]) userLevels[userId] = { xp: 0, level: 1 };
    userLevels[userId].xp += Math.floor(Math.random() * 10) + 5;
    if (userLevels[userId].xp >= userLevels[userId].level * 100) {
        userLevels[userId].level += 1;
        message.channel.send(`🎉 مبروك ${message.author}! ارتفع مستواك إلى **المستوى ${userLevels[userId].level}**!`);
    }
    saveLevels();

    // لعبة التخمين
    if (activeGames.has(channelId)) {
        const target = activeGames.get(channelId);
        const guessed = parseInt(lowerContent);
        if (!isNaN(guessed) && guessed === target) {
            activeGames.delete(channelId);
            return message.reply(`🎉 **كفووو!** إجابة صحيحة، الرقم هو **${target}**!`);
        }
    }

    // الردود التلقائية
    if (autoResponses[lowerContent]) {
        return message.reply(autoResponses[lowerContent]);
    }

    // تفعيل الذكاء الاصطناعي
    const isMentioned = message.mentions.has(client.user);
    const isAiPrefix = lowerContent.startsWith('!ai') || lowerContent.startsWith('يا بوت');
    let isReplyToBot = false;

    if (message.reference && message.reference.messageId) {
        try {
            const referencedMsg = await message.channel.messages.fetch(message.reference.messageId);
            if (referencedMsg && referencedMsg.author.id === client.user.id) isReplyToBot = true;
        } catch (e) {}
    }

    if (isMentioned || isAiPrefix || isReplyToBot) {
        try {
            await message.channel.sendTyping();
            let cleanPrompt = message.content
                .replace(/<@!?\d+>/g, '')
                .replace(/^!ai/i, '')
                .replace(/^يا بوت/i, '')
                .trim();

            if (!cleanPrompt) cleanPrompt = "أهلاً";

            if (!conversationHistory.has(channelId)) conversationHistory.set(channelId, []);
            const history = conversationHistory.get(channelId);

            history.push({ role: 'user', content: cleanPrompt });
            if (history.length > 20) history.shift();

            const chatCompletion = await groq.chat.completions.create({
                messages: [SYSTEM_PROMPT, ...history],
                model: 'openai/gpt-oss-20b',
            });

            const replyText = chatCompletion.choices[0]?.message?.content || 'هلا بك!';
            history.push({ role: 'assistant', content: replyText });

            if (replyText.length > 2000) {
                const chunks = replyText.match(/[\s\S]{1,1900}/g) || [];
                for (const chunk of chunks) await message.reply(chunk);
            } else {
                await message.reply(replyText);
            }
        } catch (error) {
            console.error('Groq AI Error:', error);
            const history = conversationHistory.get(message.channel.id);
            if (history) history.pop();
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
