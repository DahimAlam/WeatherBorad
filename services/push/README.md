# Push sender repair

`webpush.ts` is a corrected copy of the sender from the existing [Lovable project](https://lovable.dev/projects/97c3f284-b63f-4355-895a-6c0dcc3589c8), path `src/lib/push/webpush.ts`, commit `8e0b7f1735dab40c19836039ba13a73f61db669b`.

The original encrypted record placed `0x02` before the JSON payload. RFC 8188 requires the final-record delimiter after the content. The local correction is verified by independent decryption in `tests/unit/webpush.test.ts`.

This file is **not imported into the frontend and not deployed**. VAPID private keys must remain in server secrets. Lovable has run out of credits, so its source cannot currently be repaired using the connected editing tool. Do not enable the frontend's scheduler configuration against the uncorrected service.

Before publishing the service:

1. Apply this sender correction to the existing Lovable project and run its tests.
2. Restrict push endpoint destinations to recognized browser push services, reject redirects, validate subscription key lengths, and reject disallowed write origins.
3. Preserve the last-sent date when editing a reminder; add atomic delivery claims and pagination to avoid duplicate or starved delivery.
4. Verify the managed authenticated scheduler and published CORS/API behavior. The prior implementation used 15-minute dispatch intervals.
5. Test delivery to a real browser subscription with the tab closed. HTTP acceptance by a test sink is not proof of browser delivery.
6. Only then configure `VITE_PUSH_API_URL` and `VITE_VAPID_PUBLIC_KEY` and rebuild the frontend.

The original Lovable scaffold and the current frontend have different source histories; see the root `PROMPTS.md`. No paid plan was purchased.
