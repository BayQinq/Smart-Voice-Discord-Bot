require('dotenv').config();
const { Client, GatewayIntentBits, PermissionsBitField, ApplicationCommandType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
  ]
});

const TOKEN = 'TOKEN_CODE';


const fs = require('fs');
const path = require('path');

// Settings dosyasını yükle
let settings = { 
  guilds: {}, 
  tempChannels: new Set() 
};
const settingsPath = path.join(__dirname, 'settings.json');

// Settings dosyasını oku
try {
  const loadedSettings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  settings.guilds = loadedSettings.guilds;
  // Array'i Set'e dönüştür ve null kontrolü yap
  if (Array.isArray(loadedSettings.tempChannels)) {
    settings.tempChannels = new Set(loadedSettings.tempChannels);
  }
} catch (error) {
  console.error('Settings yükleme hatası:', error);
  // Dosya yoksa veya bozuksa yeni oluştur
  fs.writeFileSync(settingsPath, JSON.stringify({
    guilds: {},
    tempChannels: []
  }, null, 2));
}

// Settings'i kaydetme fonksiyonu
function saveSettings() {
  const settingsToSave = {
    guilds: settings.guilds,
    tempChannels: Array.from(settings.tempChannels) // Set'i Array'e dönüştür
  };
  fs.writeFileSync(settingsPath, JSON.stringify(settingsToSave, null, 2));
}

// Bot token'ı

// Bot hazır olduğunda komutları kaydet
client.on('ready', async () => {
  console.log(`${client.user.tag} olarak giriş yapıldı!`);
  
  const commands = [
    {
      name: 'setchannel',
      description: 'Bekleme odasını ayarla',
      type: ApplicationCommandType.ChatInput,
    },
    {
      name: 'whitelist',
      description: 'Kilitli kanala kullanıcı ekle',
      type: ApplicationCommandType.ChatInput,
      options: [
        {
          name: 'user',
          description: 'İzin verilecek kullanıcı',
          type: 6,
          required: true
        }
      ]
    },
    {
      name: 'unwhitelist',
      description: 'Kullanıcının kanal erişimini kaldır',
      type: ApplicationCommandType.ChatInput,
      options: [
        {
          name: 'user',
          description: 'Erişimi kaldırılacak kullanıcı',
          type: 6,
          required: true
        }
      ]
    }
  ];

  try {
    // Önce tüm mevcut komutları sil
    for (const guild of client.guilds.cache.values()) {
      // Mevcut komutları al
      const existingCommands = await guild.commands.fetch();
      
      // Her komutu sil
      for (const command of existingCommands.values()) {
        await guild.commands.delete(command);
      }

      // Yeni komutları kaydet
      await guild.commands.set(commands);
      console.log(`${guild.name} sunucusu için komutlar güncellendi`);
    }
  } catch (error) {
    console.error('Komutları güncellerken hata:', error);
  }

  // Geçici kanalları kontrol et
  for (const guildId of client.guilds.cache.keys()) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) continue;

    // Her geçici kanal için kontrol yap
    for (const channelId of settings.tempChannels) {
      const channel = guild.channels.cache.get(channelId);
      if (!channel) {
        // Kanal artık yok, listeden çıkar
        settings.tempChannels.delete(channelId);
        continue;
      }

      // Kanal boşsa sil
      if (channel.members.size === 0) {
        await deleteTemporaryChannel(channel);
      }
    }
  }
  
  saveSettings();
});

// Yeni sunuculara eklendiğinde komutları otomatik kaydet
client.on('guildCreate', async (guild) => {
  const commands = [
    {
      name: 'setchannel',
      description: 'Bekleme odasını ayarla',
      type: ApplicationCommandType.ChatInput,
    },
    {
      name: 'whitelist',
      description: 'Kilitli kanala kullanıcı ekle',
      type: ApplicationCommandType.ChatInput,
      options: [
        {
          name: 'user',
          description: 'İzin verilecek kullanıcı',
          type: 6,
          required: true
        }
      ]
    },
    {
      name: 'unwhitelist',
      description: 'Kullanıcının kanal erişimini kaldır',
      type: ApplicationCommandType.ChatInput,
      options: [
        {
          name: 'user',
          description: 'Erişimi kaldırılacak kullanıcı',
          type: 6,
          required: true
        }
      ]
    }
  ];
  
  try {
    await guild.commands.set(commands);
    console.log(`${guild.name} sunucusu için komutlar kaydedildi`);
  } catch (error) {
    console.error(`${guild.name} sunucusu için komut kaydı başarısız:`, error);
  }
});

// Slash komut handler
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;

  if (interaction.commandName === 'setchannel') {
    // Komutu kullanan kişinin yetkisi var mı kontrol et
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
      return interaction.reply({ content: 'Bu komutu kullanmak için yetkiniz yok!', ephemeral: true });
    }

    // Kullanıcının ses kanalında olup olmadığını kontrol et
    const voiceChannel = interaction.member.voice.channel;
    if (!voiceChannel) {
      return interaction.reply({ content: 'Lütfen bir ses kanalında olduğunuzdan emin olun!', ephemeral: true });
    }

    // Kanalı ayarla ve izinleri düzenle
    try {
      await voiceChannel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
        Speak: false,
        Connect: true
      });

      // Ayarları kaydet
      settings.guilds[interaction.guildId] = {
        waitingRoomId: voiceChannel.id
      };
      saveSettings();

      await interaction.reply({ content: `${voiceChannel.name} bekleme odası olarak ayarlandı!`, ephemeral: true });
    } catch (error) {
      console.error(error);
      await interaction.reply({ content: 'Bir hata oluştu!', ephemeral: true });
    }
  }

  if (interaction.commandName === 'whitelist') {
    // Komutu kullanan kişinin ses kanalında olup olmadığını kontrol et
    const voiceChannel = interaction.member.voice.channel;
    if (!voiceChannel) {
      return interaction.reply({ 
        content: '❌ Bu komutu kullanmak için bir ses kanalında olmalısınız!', 
        ephemeral: true 
      });
    }

    // Kanalın geçici kanal olup olmadığını kontrol et
    if (!settings.tempChannels.has(voiceChannel.id)) {
      return interaction.reply({ 
        content: '❌ Bu komut sadece özel ses kanallarında kullanılabilir!', 
        ephemeral: true 
      });
    }

    // Hedef kullanıcıyı al
    const targetUser = interaction.options.getMember('user');
    if (!targetUser) {
      return interaction.reply({ 
        content: '❌ Kullanıcı bulunamadı!', 
        ephemeral: true 
      });
    }

    try {
      // Kullanıcıya izinleri ver
      await voiceChannel.permissionOverwrites.edit(targetUser, {
        Connect: true,
        Speak: true,
        ViewChannel: true
      });

      await interaction.reply({ 
        content: `✅ ${targetUser} kullanıcısına ${voiceChannel.name} kanalı için erişim verildi!`,
        ephemeral: true 
      });
    } catch (error) {
      console.error('Whitelist hatası:', error);
      await interaction.reply({ 
        content: '❌ Bir hata oluştu!', 
        ephemeral: true 
      });
    }
  }

  if (interaction.commandName === 'unwhitelist') {
    // Komutu kullanan kişinin ses kanalında olup olmadığını kontrol et
    const voiceChannel = interaction.member.voice.channel;
    if (!voiceChannel) {
      return interaction.reply({ 
        content: '❌ Bu komutu kullanmak için bir ses kanalında olmalısınız!', 
        ephemeral: true 
      });
    }

    // Kanalın geçici kanal olup olmadığını kontrol et
    if (!settings.tempChannels.has(voiceChannel.id)) {
      return interaction.reply({ 
        content: '❌ Bu komut sadece özel ses kanallarında kullanılabilir!', 
        ephemeral: true 
      });
    }

    // Hedef kullanıcıyı al
    const targetUser = interaction.options.getMember('user');
    if (!targetUser) {
      return interaction.reply({ 
        content: '❌ Kullanıcı bulunamadı!', 
        ephemeral: true 
      });
    }

    try {
      // Kullanıcının izinlerini kaldır
      await voiceChannel.permissionOverwrites.delete(targetUser);

      // Eğer kullanıcı kanalda ise çıkar
      if (targetUser.voice.channelId === voiceChannel.id) {
        await targetUser.voice.disconnect();
      }

      await interaction.reply({ 
        content: `✅ ${targetUser} kullanıcısının ${voiceChannel.name} kanalı için erişimi kaldırıldı!`,
        ephemeral: true 
      });
    } catch (error) {
      console.error('Unwhitelist hatası:', error);
      await interaction.reply({ 
        content: '❌ Bir hata oluştu!', 
        ephemeral: true 
      });
    }
  }
});

// Kanal silme fonksiyonunu güncelleyelim
async function deleteTemporaryChannel(channel) {
  if (!channel) return;
  
  try {
    // Önce kanalın hala var olup olmadığını kontrol et
    const fetchedChannel = await channel.fetch().catch(() => null);
    if (!fetchedChannel) {
      // Kanal zaten silinmiş, sadece listeden çıkar
      settings.tempChannels.delete(channel.id);
      saveSettings();
      return;
    }

    // Kanalı sil
    await channel.delete();
    settings.tempChannels.delete(channel.id);
    saveSettings();
    console.log(`Kanal silindi: ${channel.name} (${channel.id})`);
  } catch (error) {
    if (error.code === 10003) { // Unknown Channel hatası
      // Kanal zaten silinmiş, sadece listeden çıkar
      settings.tempChannels.delete(channel.id);
      saveSettings();
      console.log(`Kanal zaten silinmiş, listeden çıkarıldı: ${channel.id}`);
    } else {
      console.error('Kanal silme hatası:', error);
    }
  }
}

// Ses kanalı eventi
client.on('voiceStateUpdate', async (oldState, newState) => {
  // Kullanıcı bekleme odasına katılıyor mu kontrol et
  const guildSettings = settings.guilds[newState.guild.id];
  const isJoiningWaitingRoom = guildSettings && newState.channelId === guildSettings.waitingRoomId;

  // Eski kanaldan ayrılma kontrolü
  if (oldState.channel) {
    // Kullanıcı kanaldan ayrıldığında veya başka kanala geçtiğinde
    setTimeout(async () => {
      const oldChannel = oldState.channel;
      // Kanal hala var mı ve geçici kanal mı kontrol et
      if (oldChannel && settings.tempChannels.has(oldChannel.id)) {
        // Kanalda kimse kalmadıysa sil
        const currentChannel = await oldState.guild.channels.fetch(oldChannel.id).catch(() => null);
        if (currentChannel && currentChannel.members.size === 0) {
          await deleteTemporaryChannel(oldChannel);
        }
      }
    }, 1000); // Kanalın boşalmasını bekle
  }

  // Bekleme odasına giriş kontrolü
  if (isJoiningWaitingRoom) {
    try {
      // Mevcut tüm ses kanallarını al
      const voiceChannels = newState.guild.channels.cache
        .filter(channel => 
          channel.type === 2 && // Ses kanalı
          channel.name.startsWith('Sohbet #')
        );

      // Kullanılan numaraları bul
      const usedNumbers = new Set(
        Array.from(voiceChannels.values())
          .map(channel => {
            const match = channel.name.match(/Sohbet #(\d+)/);
            return match ? parseInt(match[1]) : null;
          })
          .filter(num => num !== null)
      );

      // Kullanılmayan en küçük numarayı bul
      let channelNumber = 1;
      while (usedNumbers.has(channelNumber)) {
        channelNumber++;
      }

      // Yeni ses kanalı oluştur
      const channel = await newState.guild.channels.create({
        name: `Sohbet #${channelNumber}`,
        type: 2,
        parent: newState.channel.parent,
        permissionOverwrites: [
          {
            id: newState.guild.roles.everyone,
            allow: ['Connect', 'Speak']
          }
        ]
      });

      // Kanalı geçici kanallara ekle
      settings.tempChannels.add(channel.id);
      saveSettings();

      // Kullanıcıyı yeni kanala taşı
      await newState.member.voice.setChannel(channel.id);

      // Embed mesajı oluştur
      const embed = new EmbedBuilder()
        .setColor('#FF69B4')
        .setTitle('🎵 Ses Kanalı Kontrol Paneli')
        .setDescription(`Merhaba ${newState.member}! Özel ses kanalınız oluşturuldu.\nBu paneli kullanarak kanalınızı yönetebilirsiniz.`)
        .addFields(
          { name: '🔒 Kilitle', value: 'Kanalı başkalarının girişine kapatır', inline: true },
          { name: '👥 Limit', value: 'Kanala kullanıcı limiti koyar', inline: true },
          { name: '🔑 İzinler', value: '/whitelist ve /unwhitelist ile erişimleri yönet', inline: true }
        )
        //.setImage('https://i.imgur.com/Bh4Zw3K.png')
        .setFooter({ text: '⭐ İyi sohbetler dileriz!' });

      // Butonları oluştur
      const row1 = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`lock_${channel.id}`)
            .setLabel('Kilitle/Aç')
            .setEmoji('🔒')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`limit_${channel.id}`)
            .setLabel('Limit Ayarla')
            .setEmoji('👥')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`rename_${channel.id}`)
            .setLabel('İsim Değiştir')
            .setEmoji('✏️')
            .setStyle(ButtonStyle.Secondary)
        );

      const row2 = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`privacy_${channel.id}`)
            .setLabel('Odayı Gizle/Göster')
            .setEmoji('🛡️')
            .setStyle(ButtonStyle.Danger)
        );

      // Kontrol mesajını ses kanalının metin kanalına gönder
      const controlMessage = await channel.send({
        embeds: [embed],
        components: [row1, row2]
      });

      // Buton interaksiyonlarını dinle
      const collector = controlMessage.createMessageComponentCollector({
        time: 12 * 60 * 60 * 1000
      });

      collector.on('collect', async (interaction) => {
        if (!interaction.member.voice.channel || interaction.member.voice.channel.id !== channel.id) {
          return interaction.reply({
            content: '❌ Bu işlemi yapabilmek için ses kanalında olmanız gerekiyor!',
            ephemeral: true
          });
        }

        const [action, channelId] = interaction.customId.split('_');

        switch (action) {
          case 'lock':
            const isLocked = channel.permissionOverwrites.cache.get(newState.guild.roles.everyone.id)?.deny.has('Connect');
            await channel.permissionOverwrites.edit(newState.guild.roles.everyone.id, {
              Connect: isLocked ? true : false
            });
            await interaction.reply({
              content: `🔒 Kanal ${isLocked ? 'açıldı' : 'kilitlendi'}!`,
              ephemeral: true
            });
            break;

          case 'limit':
            await interaction.showModal({
              title: "Kullanıcı Limiti Ayarla",
              custom_id: `limit_modal_${channelId}`,
              components: [{
                type: 1,
                components: [{
                  type: 4,
                  custom_id: "limit_number",
                  label: "Limit (0-99)",
                  style: 1,
                  min_length: 1,
                  max_length: 2,
                  placeholder: "Limit sayısını girin",
                  required: true
                }]
              }]
            });
            break;

          case 'perms':
            await interaction.showModal({
              title: "Kullanıcı İzni Ver",
              custom_id: `perms_modal_${channelId}`,
              components: [{
                type: 1,
                components: [{
                  type: 4,
                  custom_id: "user_id",
                  label: "Kullanıcı ID",
                  style: 1,
                  min_length: 17,
                  max_length: 19,
                  placeholder: "Kullanıcı ID'sini girin",
                  required: true
                }]
              }]
            });
            break;

          case 'privacy':
            const isPrivate = channel.permissionOverwrites.cache.get(newState.guild.roles.everyone.id)?.deny.has('ViewChannel');
            await channel.permissionOverwrites.edit(newState.guild.roles.everyone.id, {
              ViewChannel: isPrivate ? true : false
            });
            await interaction.reply({
              content: `🛡️ Kanal ${isPrivate ? 'görünür' : 'gizli'} yapıldı!`,
              ephemeral: true
            });
            break;

          case 'rename':
            await interaction.showModal({
              title: "Kanal İsmini Değiştir",
              custom_id: `rename_modal_${channelId}`,
              components: [{
                type: 1,
                components: [{
                  type: 4,
                  custom_id: "channel_name",
                  label: "Yeni İsim",
                  style: 1,
                  min_length: 1,
                  max_length: 30,
                  placeholder: "Yeni kanal ismini girin",
                  required: true
                }]
              }]
            });
            break;
        }
      });

      // Modal submit olaylarını dinle
      client.on('interactionCreate', async (interaction) => {
        if (!interaction.isModalSubmit()) return;

        const [action, channelId] = interaction.customId.split('_modal_');
        const channel = interaction.guild.channels.cache.get(channelId);

        if (!channel) {
          return interaction.reply({
            content: '❌ Kanal bulunamadı!',
            ephemeral: true
          });
        }

        switch (action) {
          case 'limit':
            const limit = parseInt(interaction.fields.getTextInputValue('limit_number'));
            if (isNaN(limit) || limit < 0 || limit > 99) {
              return interaction.reply({
                content: '❌ Geçersiz limit! 0-99 arası bir sayı girin.',
                ephemeral: true
              });
            }
            await channel.setUserLimit(limit);
            await interaction.reply({
              content: `👥 Kanal limiti ${limit} olarak ayarlandı!`,
              ephemeral: true
            });
            break;

          case 'perms':
            const userId = interaction.fields.getTextInputValue('user_id');
            try {
              const user = await interaction.guild.members.fetch(userId);
              await channel.permissionOverwrites.edit(user, {
                Connect: true,
                Speak: true,
                ViewChannel: true
              });
              await interaction.reply({
                content: `🔑 ${user} kullanıcısına erişim verildi!`,
                ephemeral: true
              });
            } catch {
              await interaction.reply({
                content: '❌ Geçersiz kullanıcı ID!',
                ephemeral: true
              });
            }
            break;

          case 'rename':
            const newName = interaction.fields.getTextInputValue('channel_name');
            await channel.setName(newName);
            await interaction.reply({
              content: `✏️ Kanal ismi "${newName}" olarak değiştirildi!`,
              ephemeral: true
            });
            break;
        }
      });

    } catch (error) {
      console.error('Hata:', error);
    }
  }
});

client.login(process.env.DISCORD_TOKEN); 