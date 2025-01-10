# 🎧 Discord Voice Channel Bot

---

### 📋 Features

-  **Waiting Room Detection**: Monitors a specified waiting room channel.  
- **Dynamic Voice Channels**: Automatically creates private voice channels for users.  
-  **Auto Deletion**: Deletes private channels when users leave.  
- **Simple Setup**: Quick and easy to configure and run.

---

### 🛠️ Requirements

- **Node.js 16.x or above**  
- **Discord.js v14 or above**  
- **A Discord Bot Token**

---

### 🚀 Setup

#### 1. Download the Project:

- Download the project files as a ZIP from the repository and extract them.  
- Navigate to the project folder.

#### 2. Install Dependencies:

- Install required dependencies for the bot to function.

#### 3. Create a Discord Bot:

- Go to the [Discord Developer Portal](https://discord.com/developers/applications) and create a new bot.  
- Add the following permissions to your bot:  
  - **Manage Server**  
  - **Manage Voice Channels**

#### 4. Add Your Bot Token:


 Open the `index.js` file and add your bot token to **line 10**:  
```base 
const TOKEN = 'TOKEN_CODE'; // Replace 'TOKEN_CODE' with your bot token.
```

#### 5. Run the Bot:

- Start the bot to enable its functionality in your server.

---

### 📦 Usage

- When a user joins the specified waiting room, the bot automatically creates a private voice channel for them.  
- When the user leaves, the bot deletes the private channel automatically.

---


### 📜 License

- This project is licensed under the MIT License. See the `LICENSE` file for more details.

---
