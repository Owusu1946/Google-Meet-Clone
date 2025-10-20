# The Google Meet Clone

A video conferencing application that replicates the core functionalities of Google Meet. Built using Next.js, TypeScript, and Stream's Video and Chat SDKs, this application allows users to conduct virtual meetings with real-time video, audio, and messaging capabilities.


## Table of Contents

- [Features](#features)
- [Demo](#demo)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Usage](#usage)
- [Technologies Used](#technologies-used)
- [Troubleshooting](#troubleshooting)
- [License](#license)

## Features

- **User Authentication**: Secure user authentication using Clerk for both registered users and guests.
- **Meeting Lobby**: Users can configure audio and video settings before joining a meeting.
- **Dynamic Video Layouts**: Supports grid and speaker layouts with smooth animations using GSAP.
- **Screen Sharing**: Participants can share their screens during the meeting.
- **Real-time Messaging**: Integrated chat functionality using Stream Chat SDK.
- **Meeting Recordings**: Ability to record meetings and access recordings afterward.
- **Responsive Design**: Fully responsive UI built with Tailwind CSS.
- **Interactive Controls**: Users can mute/unmute audio, enable/disable video, and more.

## Demo

You can access a live demo of the application [here](https://google-meet-clone-beta.vercel.app/).

## Prerequisites

- **Node.js** (v14 or higher, v18+ recommended)
- **npm** or **yarn**
- **Stream Account**: Sign up for a free account at [Stream](https://getstream.io/)
- **Clerk Account**: Sign up for a free account at [Clerk](https://clerk.dev/)
- **ngrok** (Optional): Required only if you want to enable Clerk → Stream webhook synchronization for automatic user profile updates

> **Note**: Webhooks are optional. The app works without them, but webhooks automatically sync user profile changes (name, image) from Clerk to Stream. Without webhooks, users can still join meetings and use chat.

## Installation

> **Quick Start**: For a minimal setup without webhooks, complete steps 1-4 and 7 (skip steps 5-6). See the note in step 7 about omitting `WEBHOOK_SECRET`.

1. **Clone the Repository**

   ```bash
   git clone https://github.com/yourusername/google-meet-clone.git
   cd google-meet-clone
   ```

2. **Install Dependencies**

   ```bash
   npm install
   # or
   yarn install
   ```

3. **Set Up Stream Dashboard**
   
   - Go to [Stream Dashboard](https://getstream.io/) and sign up or log in.
   - Click **Create App** or navigate to **Dashboard** → **Create App**.
   - Give your app a name (e.g., "Google Meet Clone").
   - Select a region (choose the one closest to your users).
   - Enable both:
     - **Video & Audio** (for video calling)
     - **Chat Messaging** (for in-call chat)
   - Click **Create App**.
   - After creation, navigate to your app dashboard.
   - **Copy your API credentials**:
     - Click on your app name in the dashboard.
     - Find and copy:
       - `NEXT_PUBLIC_STREAM_API_KEY` (visible on the dashboard)
       - `STREAM_API_SECRET` (click "Show" to reveal it)
     - Keep these keys handy for step 7.
   - **Update Chat Permissions**:
     - In the left sidebar, click **Chat Messaging**.
     - Navigate to **Chat** → **Roles & Permissions**.
     - Select the **user** role.
     - In the **Scope** dropdown, select **messaging**.
     - Enable these permissions:
       - **Create Message**
       - **Read Channel**
       - **Read Channel Members**
     - Click **Save** and confirm changes.

  
4. **Set Up Clerk Dashboard**
   
   - Go to [Clerk Dashboard](https://dashboard.clerk.com/) and sign up or log in.
   - Click **Create Application**.
   - Choose a name for your app (e.g., "Google Meet Clone").
   - Select authentication providers:
     - Enable **Email** and **Google** (or your preferred social login).
   - Click **Create Application**.
   - After creation, you'll see your API keys:
     - Copy `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
     - Copy `CLERK_SECRET_KEY`
   - Keep these keys handy for step 7.
    
5. **Set Up ngrok** *(Optional - skip if not using webhooks)*
   
   ngrok exposes your local development server to the internet, allowing Clerk webhooks to reach your `/api/webhooks` route.
   
   - **Install ngrok**:
     - Download from [ngrok.com](https://ngrok.com/download) or install via package manager:
       ```bash
       # macOS (Homebrew)
       brew install ngrok
       
       # Windows (Chocolatey)
       choco install ngrok
       
       # or download directly from ngrok.com
       ```
   - **Sign up for ngrok** (free account at [ngrok.com](https://ngrok.com/)) to get an auth token.
   - **Authenticate ngrok**:
     ```bash
     ngrok config add-authtoken YOUR_AUTH_TOKEN
     ```
   - **Start your Next.js dev server** (covered in Usage section):
     ```bash
     yarn dev  # or npm run dev
     ```
   - **In a separate terminal, start ngrok**:
     ```bash
     ngrok http 3000
     ```
   - **Copy the HTTPS forwarding URL** shown in the terminal (e.g., `https://abcd-12-34-56-78.ngrok-free.app`).
   - Keep ngrok running while you develop and test webhooks.

6. **Configure Clerk Webhooks** *(Optional - skip if not using webhooks)*

   - In the Clerk Dashboard, navigate to **Webhooks** in the left sidebar.
   - Click **Add Endpoint**.
   - Set the **Endpoint URL** to: `https://YOUR_NGROK_URL/api/webhooks`
     - Replace `YOUR_NGROK_URL` with the HTTPS URL from ngrok (e.g., `https://abcd-12-34-56-78.ngrok-free.app/api/webhooks`).
   - Under **Subscribe to events**, select:
     - `user.created`
     - `user.updated`
   - Click **Create**.
   - After creation, click on your webhook endpoint.
   - Copy the **Signing Secret** (starts with `whsec_`).
   - Save this as `WEBHOOK_SECRET` for step 7.
   
   **Note**: Each time you restart ngrok, the URL changes (unless you have a paid ngrok account with a static domain). You'll need to update the webhook endpoint URL in Clerk each time.
     
7. **Set Up Environment Variables**

   Create a `.env.local` file (or edit the existing `.env` file) in the root directory and add your Stream and Clerk API keys:

   ```env
   NEXT_PUBLIC_STREAM_API_KEY=your_stream_api_key
   STREAM_API_SECRET=your_stream_api_secret
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
   CLERK_SECRET_KEY=your_clerk_secret_key
   NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
   NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
   WEBHOOK_SECRET=your_clerk_webhook_signing_secret
   ```
   
   > **Note**: If you skipped webhook setup (steps 5-6), you can omit the `WEBHOOK_SECRET` line entirely, or leave it as a placeholder. The app will run normally without it.

## Usage

1. **Run the Development Server**

   ```bash
   npm run dev
   # or
   yarn dev
   ```

   The application will be available at `http://localhost:3000`.

2. **Create a New Meeting**

   - Visit `http://localhost:3000`.
   - Click on **New Meeting** to generate a unique meeting link.

3. **Join a Meeting**

   - Configure your audio and video settings in the lobby.
   - Enter the meeting and start collaborating!

## Technologies Used

- **Next.js**: React framework for server-side rendering and routing.
- **TypeScript**: Typed superset of JavaScript.
- **Tailwind CSS**: Utility-first CSS framework.
- **GSAP**: Animation library for smooth transitions.
- **Stream Video SDK**: Provides video calling functionality.
- **Stream Chat SDK**: Enables real-time messaging.
- **Clerk**: User management and authentication.
- **ngrok**: Exposes local servers to the internet securely.

## Troubleshooting

### Common Issues and Solutions

#### 1. **Webhook Secret Error**
**Problem**: `Error: Please add WEBHOOK_SECRET from Clerk Dashboard to .env or .env.local`

**Solution**:
- Ensure you've added the Clerk webhook signing secret to your `.env` or `.env.local` file.
- The secret should start with `whsec_`.
- Restart your dev server after adding environment variables.

#### 2. **Cannot Find "messaging" Scope in Stream**
**Problem**: The "messaging" scope doesn't appear in Stream's Roles & Permissions.

**Solution**:
- You're likely viewing **Video & Audio** permissions instead of **Chat Messaging**.
- In the Stream dashboard sidebar, click **Chat Messaging** (not Video & Audio).
- Navigate to **Roles & Permissions** under Chat Messaging.
- Select the `user` role and `messaging` scope.

#### 3. **Webhook Not Receiving Events**
**Problem**: Clerk webhook shows failed deliveries or no events are being received.

**Solution**:
- Verify ngrok is still running and the tunnel is active.
- Check that the webhook URL in Clerk matches your current ngrok URL exactly (including `/api/webhooks`).
- Ensure `user.created` and `user.updated` events are selected in Clerk webhook settings.
- Check your Next.js dev server console for errors.
- Verify `WEBHOOK_SECRET` matches the signing secret in Clerk.

#### 4. **ngrok URL Changes Every Restart**
**Problem**: Each time you restart ngrok, you get a new URL.

**Solution**:
- Free ngrok accounts get randomized URLs each time.
- Update the webhook URL in Clerk each time you restart ngrok.
- **Or** upgrade to a paid ngrok account for a static domain.
- **Or** use alternative tunneling services like [localhost.run](https://localhost.run) or [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/).

#### 5. **401/403 Errors from Stream**
**Problem**: Authentication errors when connecting to Stream.

**Solution**:
- Verify `NEXT_PUBLIC_STREAM_API_KEY` and `STREAM_API_SECRET` are correct.
- Ensure you copied the **API Secret** (not another credential) from Stream dashboard.
- Check that your Stream app has both Video & Audio and Chat Messaging enabled.
- Restart your dev server after updating environment variables.

#### 6. **Chat Permissions Error**
**Problem**: "You don't have permission to send messages" or similar chat errors.

**Solution**:
- Go to Stream dashboard → **Chat Messaging** → **Roles & Permissions**.
- Select `user` role and `messaging` scope.
- Ensure these permissions are enabled:
  - Create Message
  - Read Channel
  - Read Channel Members
- Click Save and refresh your app.

#### 7. **Port 3000 Already in Use**
**Problem**: `Error: Port 3000 is already in use`

**Solution**:
```bash
# Find and kill the process using port 3000
# On Windows (PowerShell):
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process

# On macOS/Linux:
lsof -ti:3000 | xargs kill

# Or run on a different port:
PORT=3001 npm run dev
# Then update ngrok: ngrok http 3001
```

#### 8. **Environment Variables Not Loading**
**Problem**: App can't read environment variables.

**Solution**:
- Ensure your env file is named `.env.local` or `.env` in the project root.
- All `NEXT_PUBLIC_*` variables are exposed to the browser; non-public vars are server-only.
- Restart your dev server after any changes to environment files.
- Don't use quotes around values in `.env` files unless the value contains spaces.

### Need More Help?

- Check the [Next.js documentation](https://nextjs.org/docs)
- Review [Stream Video SDK docs](https://getstream.io/video/docs/)
- Review [Stream Chat SDK docs](https://getstream.io/chat/docs/)
- Visit [Clerk documentation](https://clerk.com/docs)
- Check your browser console and terminal for detailed error messages

## License

This project is licensed under the [MIT License](LICENSE).