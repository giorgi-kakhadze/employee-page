# PTF / Gunda v3.38: 💬 Community — channels and chats for staff

Files changed:
- `tool/PTF-pass-to-floor-Gunda.html`
- `tool/Code.gs`
- tests:
  - new: `tests/community.test.js`;
  - changed: `tests/nav_spaces.test.js`, `tests/page_access.test.js` and `tests/ui_polish.test.js` (the new top-bar button and the version).

## Who uses it
- **All staff with a tool account:** managers, seniors, shift leads, coaches, coordinators, HR, service managers and the admin.
- **Not employees on the employee page.** Game presenters, shufflers and front stage staff never see it, neither on the employee page nor on their boards.
- **It is a space in the top bar: 💬 Community.** It has two pages: **💬 Channels** and **✉️ Chats**. A red number shows unread messages.

## Channels
- **Who creates them:** only **managers and the admin**. Seniors and other positions cannot, and the server refuses it.
- **Who is in a channel:**
  - **everyone with the tool**, or
  - **chosen departments and/or chosen people**.

  Managers always see every channel.
- **Who posts:**
  - **💬 Discussion:** everyone in the channel posts.
  - **📣 Announcements:** only managers start posts. Everyone else replies in the thread and reacts.
- **What managers can do:**
  - mark a post as **📣 Announcement**;
  - **📌 pin** up to 10 posts;
  - **remove** any message in a channel;
  - **edit** the channel (name, icon, description, audience, mode);
  - **🗄 archive** a channel, so it can be read but not written to;
  - **delete** a channel with all its messages.

  Creating, changing, archiving, deleting and removing go to the audit log.

## Chats
- **Starting a chat:** press **+ New chat** and pick **one colleague** for a direct chat or **several** for a group chat (up to 20 people, with an optional group name). If the chat already exists, it opens instead.
- **Who reads it:** only the people in the chat. **Managers do not read other people's chats** unless they are in them; the server doesn't send them.
- **Members are fixed.** Nobody can add themselves later.

## Messages
- **Sending:** Enter sends, Shift+Enter starts a new line.
- **Formatting:**
  - links are clickable;
  - **@Name** mentions a colleague (first name or full name).
- **Replies and reactions:** reply in a **thread** (↩ Reply), and react with 👍 ✅ ❤️ 😂 🎉 👀.
- **Your own messages:** edit them (shown as "edited") or delete them.
- **Delivery:** new messages arrive **within about 20 seconds** while Community is open, otherwise with the normal sync (about 1–2 minutes). It is not a live call or typing chat.
- **🔔 Bell alerts:** a message in your chats, an @mention, a reply to your message, or an announcement in your channels. Clicking one opens the conversation at that message.
- **Unread counts** show per channel and chat, on the Channels / Chats buttons and on 💬 Community in the top bar. They are kept per device.
- **Storage:** each channel or chat keeps its **newest 1,500 messages** and drops older ones. Messages are text; share files through Projects or Drive links.

## Access
- **Access management → Access by spaces and pages** lists **Community → Channels** and **Community → Chats**. You can hide either one, or make it view only, per position or person.
- **When Community is hidden for someone,** the server sends them nothing from it.
- **To start chats,** everyone receives a **staff directory** with each colleague's name and position, never more.

## Server rules (`Code.gs`, `chatPush_` / `chVis_`)
- **Channels:** only managers and the admin key create, change or delete them.
- **Messages:**
  - written only under your own e-mail;
  - only in channels and chats you read;
  - not in archived channels;
  - in an announcement channel, only managers start new posts.
- **Editing and removing:**
  - you edit only your own messages;
  - managers can only remove others' messages in channels, never in chats;
  - reactions are added and removed only by their owner.
- **Deleting a channel removes its messages.**
- **Deploy the new `Code.gs` as a new version.**
