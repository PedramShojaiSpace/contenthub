# VA Inbox Placement Examples — Initial Findings

The supplied document labels **green** examples as Gmail Primary and **red** examples as Gmail Promotions. Visual review of the opening pages confirms that the current clean Day 0 email and the Episode 1 email are marked red in the VA document, meaning they are landing in Promotions for the tested mailbox.

The Day 0 message has one optional offer button, an explicit one-time-price sentence, and a styled marketing-card layout. Episode 1 includes multiple urgency statements, promotional and testimonial-style phrasing, an external Upstream link, a P.S., and visible legacy unsubscribe/address text inside the body before the standardized footer. These are materially different content patterns and should not be treated as a single HTML-only issue.

The next audit step is to map every colored example, compare their HTML/content structure, and distinguish signals the Content Hub tool can reduce from Gmail’s account- and recipient-specific classification behavior.

## Google Guidance Relevant to This Audit

Google describes Promotions as including deals, offers, and other promotional emails, while Primary includes messages from people a recipient knows and messages that do not fall into another tab. Gmail’s tab classifier uses multiple signals, including sender identity, message content, and recipient interaction with similar messages. Google also identifies direct recipient action—moving a message, creating a filter, adding a sender to contacts, or replying—as an important individual training signal. Therefore, no HTML transformation can guarantee Primary placement for every recipient. [1] [2]

The current sender infrastructure now meets authentication requirements: the fresh Gmail header verified SPF, DKIM, and DMARC passes. Google’s sender guidance further requires accurate sender identity, visible understandable links, standards-compliant HTML, clear unsubscribe support for marketing mail, and gradual monitoring after meaningful sending/infrastructure changes. [3]

Sources: [1] [Gmail categories](https://support.google.com/mail/answer/3094499?hl=en). [2] [How Gmail sorts tabs](https://workspace.google.com/blog/productivity-collaboration/how-gmail-sorts-your-email-based-on-your-preferences). [3] [Google email sender guidelines](https://support.google.com/mail/answer/81126?hl=en-GB).
