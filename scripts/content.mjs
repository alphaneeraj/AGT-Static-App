// Static page content. Edit copy here; the build turns it into HTML, schema,
// sitemap entries and llms-full.txt sections.

export const services = [
  {
    slug: 'group-travel',
    icon: 'group',
    title: 'Group Flight Booking',
    short: 'Discounted fares for 10+ travelers on one itinerary, with flexible name changes and deposits.',
  },
  {
    slug: 'business-class',
    icon: 'seat',
    title: 'Business Class Deals',
    short: 'Lie-flat seats, lounge access and priority boarding for less than the published fare.',
  },
  {
    slug: 'private-jet-charter',
    icon: 'jet',
    title: 'Private Jet Charter',
    short: 'On-demand light, midsize and heavy jets for executives, families and VIP groups.',
  },
  {
    slug: 'deals',
    icon: 'tag',
    title: 'Group Flight Deals',
    short: 'Seasonal group fares, book now pay later plans and multi-city itineraries.',
  },
];

export const homeFaqs = [
  ['How many people count as a group booking?', 'Most airlines treat 10 or more passengers traveling together on the same flights as a group. We also help smaller parties of 6 to 9 find the best shared fare, so call even if your group is small.'],
  ['Are group flights cheaper than booking individual tickets?', 'Often, yes. Group contracts are priced from a separate fare inventory, so a group can lock in one rate for every seat instead of watching the price climb as individual seats sell. Group fares also usually allow a deposit and later name changes.'],
  ['Do I need every traveler\'s name to reserve seats?', 'No. Most group contracts let you hold seats with a deposit and submit final passenger names closer to departure, typically 30 to 60 days before travel depending on the airline.'],
  ['Can I book group travel now and pay later?', 'Yes. Many group fares need only a deposit to hold the seats, with the balance due closer to departure. Your agent will explain the deposit and final payment dates for your airline before you commit.'],
  ['Which airlines can you book for groups?', 'We work with 150+ airlines, including American Airlines, Delta, United, Southwest, JetBlue, Alaska Airlines, Emirates, Qatar Airways, Lufthansa, British Airways, Air France, Turkish Airlines and Singapore Airlines.'],
  ['How do I get a group flight quote?', `Call +1-888-609-1015 any time, 24/7, or fill in the quote form with your route, dates and group size. A group travel specialist will reply with fare options.`],
];

export const steps = [
  ['Share your trip', 'Tell us your route, travel dates, cabin and number of travelers by phone or with the quote form.'],
  ['Compare group fares', 'A specialist checks group desks across 150+ airlines and sends you the best options.'],
  ['Hold with a deposit', 'Secure every seat at one locked-in fare, then add names and pay the balance later.'],
  ['Fly together', 'Get e-tickets for the whole group plus 24/7 support before and during the trip.'],
];

export const whyUs = [
  ['One contact for the whole group', 'A dedicated agent manages seats, names, payments and changes so you are not juggling dozens of bookings.'],
  ['Fares you will not see online', 'Group desk contracts and consolidator fares are often below what public booking sites show.'],
  ['Flexible payments', 'Hold seats with a deposit, pay by debit card, credit card or online banking, and settle the balance later.'],
  ['24/7 human support', `Call +1-888-609-1015 day or night for bookings, changes, delays and cancellations.`],
];

export const airlines = [
  { slug: 'american-airlines', name: 'American Airlines', code: 'AA', alliance: 'oneworld', hubs: ['Dallas/Fort Worth (DFW)', 'Charlotte (CLT)', 'Chicago O\'Hare (ORD)', 'Miami (MIA)', 'Phoenix (PHX)', 'Philadelphia (PHL)'], region: 'US' },
  { slug: 'delta-air-lines', name: 'Delta Air Lines', code: 'DL', alliance: 'SkyTeam', hubs: ['Atlanta (ATL)', 'Detroit (DTW)', 'Minneapolis-St. Paul (MSP)', 'Salt Lake City (SLC)', 'New York JFK', 'Los Angeles (LAX)'], region: 'US' },
  { slug: 'united-airlines', name: 'United Airlines', code: 'UA', alliance: 'Star Alliance', hubs: ['Chicago O\'Hare (ORD)', 'Denver (DEN)', 'Houston (IAH)', 'Newark (EWR)', 'San Francisco (SFO)', 'Washington Dulles (IAD)'], region: 'US' },
  { slug: 'southwest-airlines', name: 'Southwest Airlines', code: 'WN', alliance: 'no alliance', hubs: ['Dallas Love Field (DAL)', 'Chicago Midway (MDW)', 'Denver (DEN)', 'Las Vegas (LAS)', 'Baltimore (BWI)'], region: 'US' },
  { slug: 'emirates', name: 'Emirates', code: 'EK', alliance: 'no alliance', hubs: ['Dubai (DXB)'], region: 'international' },
  { slug: 'qatar-airways', name: 'Qatar Airways', code: 'QR', alliance: 'oneworld', hubs: ['Doha Hamad (DOH)'], region: 'international' },
  { slug: 'lufthansa', name: 'Lufthansa', code: 'LH', alliance: 'Star Alliance', hubs: ['Frankfurt (FRA)', 'Munich (MUC)'], region: 'international' },
  { slug: 'british-airways', name: 'British Airways', code: 'BA', alliance: 'oneworld', hubs: ['London Heathrow (LHR)', 'London Gatwick (LGW)'], region: 'international' },
  { slug: 'turkish-airlines', name: 'Turkish Airlines', code: 'TK', alliance: 'Star Alliance', hubs: ['Istanbul (IST)'], region: 'international' },
  { slug: 'air-france', name: 'Air France', code: 'AF', alliance: 'SkyTeam', hubs: ['Paris Charles de Gaulle (CDG)', 'Paris Orly (ORY)'], region: 'international' },
];

export const moreAirlines = ['JetBlue', 'Alaska Airlines', 'Singapore Airlines', 'KLM', 'Air Canada', 'Etihad', 'Cathay Pacific', 'Virgin Atlantic', 'Iberia', 'Swiss', 'Air India', 'ANA', 'Japan Airlines', 'Qantas', 'LATAM', 'Aeromexico'];

export const groupTypes = [
  { slug: 'corporate-group-travel', name: 'Corporate & Business Groups', short: 'Conferences, sales kick-offs, incentive trips and team offsites.', points: ['One invoice and a single point of contact for finance', 'Name changes as attendee lists shift', 'Mixed cabins: business class for executives, economy for teams', 'Multi-city itineraries for roadshows'] },
  { slug: 'sports-team-travel', name: 'Sports Team Travel', short: 'Youth leagues, college teams, tournaments and fans following the team.', points: ['Extra baggage and equipment allowances negotiated in advance', 'Seats held together for coaches and players', 'Tight turnaround scheduling around game days', 'Parent and fan add-on bookings'] },
  { slug: 'wedding-group-flights', name: 'Destination Wedding Flights', short: 'Get the wedding party and guests to the ceremony on the same fare.', points: ['Guests pay individually while sharing one group rate', 'Deposits that hold seats before RSVPs are final', 'Name changes as the guest list evolves', 'Popular routes to Mexico, the Caribbean, Europe and Asia'] },
  { slug: 'school-student-group-travel', name: 'School & Student Groups', short: 'Educational tours, study abroad, band and choir trips.', points: ['Chaperone seating next to students', 'Payment plans that suit school fundraising timelines', 'Help with minors traveling documentation reminders', 'Budget-friendly routings'] },
  { slug: 'religious-mission-group-travel', name: 'Church & Mission Trips', short: 'Pilgrimages, mission teams and faith-based tours worldwide.', points: ['Pilgrimage routes to Israel, Rome, Mecca and more', 'Extra baggage for mission supplies', 'Deposit and name-change flexibility', 'Support across multiple connections'] },
  { slug: 'family-reunion-group-flights', name: 'Family Reunions & Events', short: 'Bring relatives from several cities to one celebration.', points: ['Multiple departure cities arriving together', 'Mix of adults, seniors, children and infants', 'Special assistance requests handled for you', 'Birthday, anniversary and holiday travel'] },
];

export const staticPages = {
  'group-travel': {
    title: 'Group Flight Booking for 10+ Travelers',
    metaTitle: 'Group Flight Booking | Discounted Group Airfare 10+ Passengers',
    description: 'Book discounted group flights for 10 or more travelers on 150+ airlines. Deposits, flexible name changes and 24/7 support. Call +1-888-609-1015 for a free quote.',
    lead: 'One locked-in fare for every traveler, a deposit to hold the seats, and a dedicated agent from quote to landing.',
    serviceType: 'Group airline ticket booking',
    body: `
<h2>What is a group flight booking?</h2>
<p>A group booking is a single reservation for 10 or more passengers flying the same itinerary. Instead of buying seats one at a time, and watching the price rise as seats sell, the airline's group desk prices the whole party together from a dedicated fare inventory.</p>
<p>Airlines Group Travel requests those group contracts for you, compares them across carriers and manages the booking until everyone is home.</p>
<h2>Benefits of booking group airfare with us</h2>
<ul>
<li><strong>One fare for everyone.</strong> The group rate is locked for every seat on the contract.</li>
<li><strong>Hold seats with a deposit.</strong> Reserve now and pay the balance closer to departure.</li>
<li><strong>Names later.</strong> Submit final passenger names weeks before the flight, not on the day you book.</li>
<li><strong>Free seat release.</strong> Many contracts let you release a limited number of unused seats before ticketing.</li>
<li><strong>Dedicated agent.</strong> One specialist handles seating, special meals, wheelchair assistance and changes.</li>
</ul>
<h2>Who we book group flights for</h2>
<p>We arrange group air travel for corporate teams, conferences, sports teams, destination weddings, school and student trips, church and mission groups, tour operators and family reunions.</p>
<h2>How much does group airfare cost?</h2>
<p>Group fares depend on the route, season, cabin and how far ahead you book. Booking 3 to 11 months in advance usually gives the widest choice of flights and the best rates. Call <a href="tel:+18886091015">+1-888-609-1015</a> with your dates for an exact quote.</p>
<h2>Domestic and international group flights</h2>
<p>We book groups within the United States and to Europe, Asia, the Middle East, Africa, Latin America and the Caribbean, including one-way, round-trip and multi-city itineraries.</p>`,
  },
  'business-class': {
    title: 'Business Class Flight Deals',
    metaTitle: 'Cheap Business Class Flights | Discounted Business Class Tickets',
    description: 'Save on business class flights with Airlines Group Travel. Lie-flat seats, lounge access and priority boarding on 150+ airlines. Call +1-888-609-1015 24/7.',
    lead: 'Premium cabins on the world\'s leading airlines, for individual travelers and executive groups, at fares below the published price.',
    serviceType: 'Business class airline ticket booking',
    body: `
<h2>Why book business class through a travel agency?</h2>
<p>Business class fares vary widely between booking channels. Travel agencies can access negotiated and consolidator fares that are not sold on airline websites, which often makes premium travel far more affordable.</p>
<h2>What you get in business class</h2>
<ul>
<li>Lie-flat or recliner seats with direct aisle access on long-haul routes</li>
<li>Airport lounge access before departure</li>
<li>Priority check-in, security (where available) and boarding</li>
<li>Larger baggage allowances</li>
<li>Chef-designed meals and premium drinks</li>
</ul>
<h2>Popular business class airlines</h2>
<p>Our agents regularly book business class on Emirates, Qatar Airways, Singapore Airlines, Lufthansa, British Airways, Turkish Airlines, Air France, Delta One, United Polaris and American Airlines Flagship Business.</p>
<h2>Business class for groups</h2>
<p>Traveling as an executive team or VIP party? We can hold business class seats for the group, mix cabins for different travelers and keep everything on one itinerary.</p>
<h2>Tips for finding cheaper business class fares</h2>
<ul>
<li>Be flexible by a day or two on departure dates.</li>
<li>Compare nearby airports and one-stop routings.</li>
<li>Book long-haul premium cabins 2 to 6 months ahead.</li>
<li>Ask an agent about unpublished fares before paying full price online.</li>
</ul>`,
  },
  'private-jet-charter': {
    title: 'Private Jet Charter',
    metaTitle: 'Private Jet Charter Flights | On-Demand Jet Rental',
    description: 'Charter a private jet for business, family or VIP group travel. Light, midsize and heavy jets on demand. Call Airlines Group Travel at +1-888-609-1015.',
    lead: 'Fly on your schedule, from the airport closest to you, with only the people you choose.',
    serviceType: 'Private jet charter',
    body: `
<h2>Private jet charter made simple</h2>
<p>Tell us where and when you want to fly and how many passengers are traveling. We source available aircraft from vetted charter operators and send you options with pricing.</p>
<h2>Aircraft categories</h2>
<ul>
<li><strong>Turboprops and light jets:</strong> up to about 6 to 8 passengers, ideal for short regional hops.</li>
<li><strong>Midsize and super-midsize jets:</strong> roughly 7 to 9 passengers, coast-to-coast range with more cabin space.</li>
<li><strong>Heavy and long-range jets:</strong> larger groups and non-stop international flights.</li>
<li><strong>Group airliner charters:</strong> full aircraft for sports teams, tours and events.</li>
</ul>
<h2>Why charter a private jet?</h2>
<ul>
<li>Choose your own departure time</li>
<li>Use smaller, less crowded airports and private terminals</li>
<li>Fly direct to destinations without airline service</li>
<li>Privacy for business discussions and VIP travelers</li>
</ul>
<h2>Request a charter quote</h2>
<p>Call <a href="tel:+18886091015">+1-888-609-1015</a> or use the form below. Share your route, dates, number of passengers and any special requests.</p>`,
  },
  deals: {
    title: 'Group Flight Deals & Offers',
    metaTitle: 'Group Flight Deals | Book Now, Pay Later Group Airfare',
    description: 'Latest group flight deals, book now pay later plans and multi-city group airfare. Call +1-888-609-1015 for today\'s best group fares.',
    lead: 'Fares change daily. Call for live group pricing, or send your trip details and we will send you the best current offers.',
    serviceType: 'Discounted group airfare',
    body: `
<h2>Ways to save on group flights</h2>
<ul>
<li><strong>Book early.</strong> Group desks open inventory up to 11 months before departure.</li>
<li><strong>Travel mid-week.</strong> Tuesday, Wednesday and Saturday departures are often cheaper.</li>
<li><strong>Consider shoulder seasons.</strong> Spring and autumn usually have lower fares than peak summer and holidays.</li>
<li><strong>Use a deposit.</strong> Lock today's group rate with a deposit instead of risking a fare increase.</li>
<li><strong>Stay flexible on airports.</strong> Nearby or secondary airports can reduce the total cost.</li>
</ul>
<h2>Book now, pay later</h2>
<p>Many group contracts need only a deposit to secure the seats. The remaining balance is paid closer to departure, which makes it easier to collect money from each traveler.</p>
<h2>Round-trip, one-way and multi-city</h2>
<p>We price every type of itinerary, including open-jaw trips where the group flies into one city and home from another.</p>
<h2>Get today's best fare</h2>
<p>Deals are subject to availability and change without notice. For live pricing call <a href="tel:+18886091015">+1-888-609-1015</a>, 24 hours a day.</p>`,
  },
  about: {
    title: 'About Airlines Group Travel',
    metaTitle: 'About Us | Airlines Group Travel',
    description: 'Airlines Group Travel is a US travel agency specializing in group flights, business class and private jet charters since 2022. Call +1-888-609-1015.',
    lead: 'Group travel specialists helping teams, families and organizations fly together since 2022.',
    body: `
<h2>Who we are</h2>
<p>Airlines Group Travel is an independent travel agency based in Dover, Delaware. Since 2022 we have focused on the travel that is hardest to book online: large groups, premium cabins and private charters.</p>
<h2>What we do</h2>
<p>Our agents request group contracts from airline group desks, compare fares across 150+ carriers and manage every detail of the booking, from deposits and names to seat maps and schedule changes.</p>
<h2>Our promise</h2>
<ul>
<li>Clear quotes with deposit and payment dates explained upfront</li>
<li>One dedicated agent for your group</li>
<li>Round-the-clock help at <a href="tel:+18886091015">+1-888-609-1015</a></li>
</ul>
<h2>Independent agency</h2>
<p>Airlines Group Travel is an independent travel agency. We are not an airline and are not owned by or affiliated with any airline mentioned on this site. Airline names are used only to describe the carriers we book.</p>`,
  },
  faq: {
    title: 'Group Travel FAQ',
    metaTitle: 'Group Flight Booking FAQ | Airlines Group Travel',
    description: 'Answers to common questions about group flight bookings, deposits, name changes, business class and private jet charters. Call +1-888-609-1015.',
    lead: 'Everything you need to know about booking flights for a group.',
    faqs: [
      ...homeFaqs,
      ['What is the deposit for a group booking?', 'Deposits vary by airline and route. Some carriers ask for a fixed amount per seat, others a percentage of the fare. Your quote will list the deposit and when it is due.'],
      ['When are final names due?', 'Airlines usually require final passenger names between 30 and 60 days before departure. Some international contracts need them earlier. We remind you before every deadline.'],
      ['Can we change names after ticketing?', 'Name changes after tickets are issued are limited and depend on the airline\'s rules. Before ticketing, names can normally be changed freely.'],
      ['Can group travelers sit together?', 'Group contracts give us the best chance to block seats together. Seat assignments depend on the aircraft and fare, and we request them as early as the airline allows.'],
      ['Do you book one-way and multi-city group trips?', 'Yes. We book round-trip, one-way, open-jaw and multi-city group itineraries.'],
      ['What payment methods do you accept?', 'We accept major debit and credit cards and online bank payments. Your agent will confirm the options available for your booking.'],
      ['Can you help if our flight is delayed or cancelled?', 'Yes. Call our 24/7 line at +1-888-609-1015 and an agent will work with the airline to rebook your group.'],
      ['Are you an airline?', 'No. Airlines Group Travel is an independent travel agency that books flights on many airlines. We are not affiliated with any airline.'],
    ],
  },
  contact: {
    title: 'Contact Airlines Group Travel',
    metaTitle: 'Contact Us | Call +1-888-609-1015 24/7',
    description: 'Contact Airlines Group Travel 24/7 at +1-888-609-1015 or info@airlinesgrouptravel.com for group flights, business class and charter quotes.',
    lead: 'Speak to a group travel specialist any time of day.',
  },
  'privacy-policy': {
    title: 'Privacy Policy',
    metaTitle: 'Privacy Policy | Airlines Group Travel',
    description: 'How Airlines Group Travel collects, uses and protects personal information submitted through this website.',
    legal: true,
    body: `
<p><em>Last updated: September 30, 2026</em></p>
<h2>Information we collect</h2>
<p>When you request a quote or contact us we collect the details you provide, such as your name, email address, phone number, trip details and message. We also collect standard technical data such as browser type and pages visited.</p>
<h2>How we use it</h2>
<p>We use your information to respond to your request, prepare quotes, make bookings you ask for, and improve our website. We do not sell your personal information.</p>
<h2>Sharing</h2>
<p>We share booking details with airlines, charter operators and payment processors only as needed to complete your travel. Our website and database providers process data on our behalf.</p>
<h2>Retention and your rights</h2>
<p>We keep enquiry data only as long as needed for the purposes above or as required by law. To access, correct or delete your data, email <a href="mailto:info@airlinesgrouptravel.com">info@airlinesgrouptravel.com</a>.</p>
<h2>Contact</h2>
<p>Airlines Group Travel, 8 The Green, Suite A, Dover, DE 19901, USA. Phone <a href="tel:+18886091015">+1-888-609-1015</a>.</p>`,
  },
  terms: {
    title: 'Terms & Conditions',
    metaTitle: 'Terms & Conditions | Airlines Group Travel',
    description: 'Terms and conditions for using the Airlines Group Travel website and booking services.',
    legal: true,
    body: `
<p><em>Last updated: September 30, 2026</em></p>
<h2>Our role</h2>
<p>Airlines Group Travel acts as a travel agent. Flights are operated by the airlines and charter operators named on your itinerary, and their conditions of carriage apply.</p>
<h2>Quotes and prices</h2>
<p>Quotes are based on availability at the time they are given and are not guaranteed until a deposit or payment is received and the booking is confirmed. Fares, taxes and fees may change without notice.</p>
<h2>Deposits, payments and cancellations</h2>
<p>Deposit amounts, payment deadlines, name-change rules and cancellation penalties depend on the airline contract and are explained in your quote. Deposits may be non-refundable.</p>
<h2>Travel documents</h2>
<p>Travelers are responsible for valid passports, visas and health documents required for their journey.</p>
<h2>Website content</h2>
<p>Content on this site is for general information. Airline names and trademarks belong to their owners and are used only to identify the carriers we book. We are not affiliated with any airline.</p>
<h2>Contact</h2>
<p>Questions? Call <a href="tel:+18886091015">+1-888-609-1015</a> or email <a href="mailto:info@airlinesgrouptravel.com">info@airlinesgrouptravel.com</a>.</p>`,
  },
};
