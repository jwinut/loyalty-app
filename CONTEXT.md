# HF Loyalty

The loyalty program for the HF hotel group. One program, one membership,
spanning every property the group operates.

## Language

**Program**:
The single loyalty scheme covering all properties. There is exactly one;
membership, points, and tiers are program-wide, never per-property.

**Property**:
A physical hotel a stay happens at. Currently two: HF (The Harbour Front
Hotel) and HF Ville. A property is an attribute of a stay or redemption,
not a boundary of the program.
_Avoid_: location, branch, hotel (ambiguous between the group and one building)

**Member**:
A person enrolled in the Program. One member has one membership regardless
of how many properties they stay at.
_Avoid_: customer, account

**Stay**:
A completed, checked-out occupancy at one property, as recorded by the PMS.
The source event for Nights and points; every stay belongs to exactly one
property.

**Night**:
One night of a Stay at any property. The unit that drives tier progression,
summed across all properties.

**Tier**:
A member's level (Bronze / Silver / Gold / Platinum), computed from total
nights across all properties — never from points, never per-property.

**Coupon**:
A redeemable benefit issued to a Member. Program-wide by default; may be
restricted to a single property at creation, enforced at redemption.

**Deposit**:
The payment that confirms an in-app booking: 50% of the booking total, or
the full amount if the guest chooses. Paid by PromptPay transfer into the
booked property's own receiving account; the balance is due at the desk.

**OA (Official Account)**:
A property's LINE presence. Each property has exactly one OA. An OA is a
door into the Program — never a program boundary.
_Avoid_: LINE account, bot

**Guest Profile**:
The PMS's record of a real-world guest (name, phone, documents), built from
bookings and check-ins. Lives in the PMS — the Program never duplicates it.
_Avoid_: CRM record, customer record

**Link**:
The association between a Member and a Guest Profile. Created by staff
scanning the member's QR at the desk, or by phone-number search when the QR
moment was missed. A member is linked at most once; once linked, their stays
can be attributed to their membership.

**Member QR**:
The scannable code in the member's app that identifies their membership to
staff. The physical handshake that creates a Link.

**Friendship**:
A member's opt-in to receive LINE messages from one specific OA. Tracked
per OA; a member can hold zero, one, or two friendships. Messages about an
event at a property are sent by that property's OA (property-affinity),
falling back to whichever OA the member has friended.
