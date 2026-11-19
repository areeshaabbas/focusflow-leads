\# FocusFlow



A React Native app that receives Facebook lead-form submissions and shows them in a live inbox.



I built this project to demonstrate the flow from a Meta lead submission to an update on an already-open mobile screen. The demo uses Meta’s Lead Ads Testing Tool and an Android emulator, without running paid ads.



\## What it does



\- Displays new leads automatically without a manual refresh.

\- Saves leads locally in SQLite so they survive backend restarts.

\- Searches leads by name or email.

\- Opens a details view with the lead’s name, email, and ID.

\- Shows the connection state and reconnects when the backend returns.

\- Checks webhook signatures and avoids saving the same lead ID twice.



\## How it works



Meta sends a `leadgen` notification to the backend through an ngrok HTTPS tunnel.



The notification contains a lead ID. The backend uses a Page access token to fetch the lead’s details from Meta’s Graph API, saves them in SQLite, and sends the updated list to connected apps through Socket.IO.



The mobile app listens for `leads:updated` and updates its screen. When it connects or reconnects, the backend sends the current saved list.



\## Stack



\- React Native, Expo, and TypeScript

\- Node.js and Express

\- Socket.IO

\- SQLite through Node’s built-in `node:sqlite` module

\- Meta Graph API and Webhooks

\- ngrok for the local HTTPS tunnel



\## Project files



\- `backend/server.js` — HTTP routes, webhook handling, and Socket.IO.

\- `backend/database.js` — SQLite storage.

\- `backend/.env.example` — required environment variables.

\- `mobile/App.tsx` — inbox, search, connection indicator, and lead details.



\## Running locally



The commands below use Windows Command Prompt.



You need Node.js with support for `node:sqlite`, npm, ngrok, and an Android emulator with Expo Go. You also need a Meta developer app and a Facebook Page you manage to test the Meta integration.



\### 1. Clone and install



```cmd

git clone https://github.com/areeshaabbas/focusflow-leads.git

cd focusflow-leads

cd backend

npm ci

cd ..\\mobile

npm ci

cd ..

```



\### 2. Configure the backend



```cmd

cd backend

copy .env.example .env

```



Fill in `.env` with your own values:



| Variable | Purpose |

| --- | --- |

| `META\_APP\_SECRET` | App secret used to validate webhook signatures |

| `META\_VERIFY\_TOKEN` | A value you choose and also enter in Meta’s webhook configuration |

| `META\_PAGE\_ACCESS\_TOKEN` | Page access token with the permissions needed to retrieve leads |

| `META\_PAGE\_ID` | ID of the Facebook Page being used |

| `META\_GRAPH\_VERSION` | Graph API version; the example uses `v27.0` |



Start the server:



```cmd

node --env-file=.env server.js

```



The backend listens on port `3000`. It creates its local SQLite database when needed. Credentials and database files are excluded from Git.



\### 3. Start ngrok



In a separate terminal:



```cmd

ngrok http 3000

```



Keep this terminal running. Use the HTTPS forwarding address for your Meta webhook:



```text

https://YOUR-NGROK-DOMAIN/webhook

```



The demo privacy notice is available at:



```text

https://YOUR-NGROK-DOMAIN/privacy

```



If the ngrok address changes, update the URLs configured in Meta.



\### 4. Configure Meta



The setup used for this demo includes:



\- The lead capture use case in the Meta developer app.

\- A verified Page webhook callback.

\- A subscription to the `leadgen` webhook field.

\- The app subscribed to the selected Page.

\- A Page access token with the required permissions and access to that Page’s leads.

\- An Instant Form belonging to the Page.



Use the same verify token in Meta’s webhook settings and the backend `.env`.



\### 5. Start the Android app



Start the Android emulator. In a new terminal, run:



```cmd

"%LOCALAPPDATA%\\Android\\Sdk\\platform-tools\\adb.exe" reverse tcp:3000 tcp:3000

```



This forwards the emulator’s port `3000` to the backend running on the computer. The app uses:



```text

http://127.0.0.1:3000

```



From the repository’s `mobile` folder:



```cmd

npx expo start

```



Press `a` to open the app on Android.



Keep the backend, ngrok, and Expo running during the demonstration. After restarting the emulator, run the `adb reverse` command again.



\## Testing the full flow



1\. Open the mobile app and wait for the connection indicator to show `Live`.

2\. Open Meta’s Lead Ads Testing Tool.

3\. Select the configured Page and Instant Form.

4\. Create a test lead. If one already exists for that form, delete that test lead first.

5\. Leave the mobile screen open without touching or refreshing it.

6\. Check that the new lead appears and the count increases.



Meta’s generated test leads may contain a placeholder name and `test@meta.com`. The app displays the values returned by Meta.



I also checked:



\- Searching by name and email.

\- The empty state when a search has no matches.

\- Opening and closing lead details.

\- Restarting the backend and confirming saved leads remain available.



\## Troubleshooting



\*\*The app keeps reconnecting\*\*



Check that the backend is running on port `3000` and run `adb reverse` again with the emulator open.



\*\*Meta reports an expired access token\*\*



Replace `META\_PAGE\_ACCESS\_TOKEN` in `.env` with a valid Page token and restart the backend.



\*\*A webhook fails\*\*



Check the backend terminal and ngrok’s request inspector at `http://127.0.0.1:4040`. The backend logs the processing error.



\*\*A test lead cannot be retrieved\*\*



Confirm that the lead still exists, the token belongs to the correct Page, and the token has the required permissions. A notification for a deleted test lead may no longer be retrievable.



\## Assumptions and limitations



\- This is a single-Page demonstration using dummy test data.

\- The mobile demo was tested on a Pixel 8 Android emulator.

\- The backend runs locally and needs to remain online to receive webhook requests.

\- SQLite data stays on the machine running the backend. It is not included in the repository.

\- Access tokens can expire and may need to be replaced.

\- The app has no user login or per-user access control. It is a development demo, not a production deployment for real customer data.

\- The backend processes lead retrieval during the webhook request. There is no background job queue.

\- The submitted mobile screen includes the inbox, search, and read-only details. Editing lead statuses and notes is outside this version’s scope.

