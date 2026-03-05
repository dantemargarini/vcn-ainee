# GHL Workflow: Send Inbound Messages to Ainee (Vercel)

Use this when GoHighLevel doesn’t give you a simple “webhook URL” field and you only have **Workflows** (and maybe Private Integration / PIT key).

---

## 1. Create the workflow

1. In GHL, go to **Automation** (or **Workflows**).
2. Click **Create Workflow** (or **+ New**).
3. Name it something like **Ainee inbound SMS**.

---

## 2. Set the trigger

1. Click the **Trigger** (first node).
2. Search for **Customer Replied** (or **Contact Replied** / **Inbound Message** – name can vary).
3. Select **Customer Replied**.
4. In the trigger settings, add a filter:
   - **Reply channel** (or **Channel**) = **SMS**  
   so it only runs when someone replies via SMS.
5. Save the trigger.

---

## 3. Add the Webhook action

1. Click the **+** on the canvas to add a step.
2. In the actions list, search for **Webhook**.
3. Choose **Webhook** (outbound – “send data to a URL”).
4. In the webhook config:
   - **URL:**  
     `https://vcn-ainee.vercel.app/api/webhooks/ghl/inbound`  
     (use your real Vercel URL if different.)
   - **Method:** **POST**
   - **Action name:** e.g. `Send to Ainee`

---

## 4. Add Custom Data (so Ainee gets what she needs)

The webhook must send at least **contactId**, **message body**, and ideally **conversationId**. GHL often sends contact + message by default; add Custom Data to match our names.

In the same Webhook step, find **Custom Data** (or **Add data** / **Payload**).

Click **+ Add item** and add these **Key** → **Value** pairs (use the merge tags your GHL shows; names may vary):

| Key          | Value (merge tag)        | Notes                          |
|-------------|---------------------------|---------------------------------|
| `contactId` | `{{contact.id}}`          | Required. Contact ID.          |
| `body`      | `{{message.body}}`       | Required. Incoming message.    |
| `conversationId` | `{{conversation.id}}` | If your plan has it. Conversation. |
| `locationId`    | `{{location.id}}`     | Optional. Your location ID.    |

- If you don’t see **conversationId** / **conversation.id**: leave it out. The app will try to get it from the contact. If Ainee still doesn’t reply, your plan might not send conversation in the payload; then you’d need to use a different trigger or contact GHL support.
- **locationId**: if you have a merge tag like `{{location.id}}`, add it so the app knows which location.

Save the Webhook action.

---

## 5. Publish and test

1. **Save** the workflow.
2. Turn it **On** / **Publish**.
3. Send a test SMS to your GHL number from your phone (e.g. 6198693700).
4. Check that:
   - The workflow runs (e.g. in **Execution log** or **Workflow history**).
   - Your Vercel app receives the request (e.g. **Vercel → Logs** or **Functions** for `api/webhooks/ghl/inbound`).
   - Ainee replies on the thread.

If the workflow runs but Ainee doesn’t reply, check Vercel logs for errors (e.g. missing `conversationId` or env vars).

---

## Quick checklist

- [ ] Trigger: **Customer Replied** (or equivalent), filter **SMS**.
- [ ] Action: **Webhook**, method **POST**, URL = `https://vcn-ainee.vercel.app/api/webhooks/ghl/inbound`.
- [ ] Custom Data: `contactId` = `{{contact.id}}`, `body` = `{{message.body}}`; add `conversationId` and `locationId` if your GHL has those merge tags.
- [ ] Workflow is **On** / **Published**.
- [ ] Vercel env vars are set and the site is not 404.
