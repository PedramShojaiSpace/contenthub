# LP-3 final Unbounce editor step

This is the only remaining provider-side action that cannot be completed through the connected Unbounce API because the current LP-3 champion was built in the Classic Builder.

1. Sign in to Unbounce and open **The Urban Monk - Interconnected Full Screening - Funnel LP copy 1** at `try.theurbanmonk.com/interconnected-lp-3`.
2. Choose **Edit** for the live Classic Builder variant **E**.
3. Open the page **JavaScripts** manager.
4. Find the existing custom script containing `window.addEventListener('klaviyoForms'` and the bridge URL `https://content.theurbanmonk.com/api/interconnected/unbounce-lead`.
5. Replace that entire script with the exact contents of `unbounce-lp3-native-form-attribution-script.txt`.
6. Keep placement at **Before Body End** and apply the script to the main page.
7. Save and **Publish** the page.

Do not change the form, confirmation redirect, native webhook, SMS checkbox, phone field, traffic allocation, or page URL. After publishing, report **saved** so a second email-only validation can confirm the four launch UTMs are stored and that only one Meta CAPI Lead is emitted.
