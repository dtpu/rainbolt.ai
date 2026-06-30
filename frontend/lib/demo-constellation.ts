import { GlobeSessionWithData, SessionLink } from "@/lib/globe-database";
import { Marker, Message } from "@/components/useChatStore";

// Seed data for the signed-out "guest" view of the learning constellation.
// Lets a visitor (e.g. a recruiter) see the feature populated without logging
// in. All ids are namespaced `demo-` so they never collide with real sessions,
// and the dates are static so the build stays deterministic.
interface DemoPlace {
  lat: number;
  lng: number;
  name: string;
  thumb: string;
}

// Real sessions use Firebase-generated unique ids; these demos derive a stable,
// opaque id from their slug so the URLs read like real session ids (e.g.
// /chat/s_1a2b3c) instead of guessable names, and still expand cleanly.
function oid(slug: string): string {
  let h = 2166136261;
  for (let i = 0; i < slug.length; i++) {
    h ^= slug.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return "s_" + (h >>> 0).toString(36).padStart(7, "0").slice(0, 8);
}

const demoSession = (
  id: string,
  title: string,
  images: number,
  chats: number,
  lastAccessedAt: string,
  place: DemoPlace,
  status: "active" | "completed" = "active",
): GlobeSessionWithData => ({
  id: oid(id),
  userId: "demo",
  title,
  status,
  createdAt: "2026-05-01T00:00:00.000Z",
  updatedAt: lastAccessedAt,
  lastAccessedAt,
  data: {
    // The first globe image carries the resolved guess (coordinates, place
    // name, and a street-level thumbnail) so the constellation can plot it as a
    // real pin on the globe; the remaining slots just preserve the image count.
    globeImages: [
      {
        id: `demo-img-${id}`,
        location: { lat: place.lat, lng: place.lng },
        locationName: place.name,
        imageUrl: place.thumb,
      },
      ...Array.from({ length: Math.max(0, images - 1) }),
    ],
    chatHistory: Array.from({ length: chats }),
  },
});

export const DEMO_SESSIONS: GlobeSessionWithData[] = [
  demoSession("tokyo", "Tokyo back-alleys", 6, 14, "2026-06-17T00:00:00.000Z", {
    lat: 35.6595,
    lng: 139.7005,
    name: "Nonbei Yokocho, Shibuya",
    thumb: "/demo/tokyo-1.jpg",
  }),
  demoSession("fjords", "Norwegian fjords", 4, 9, "2026-06-15T00:00:00.000Z", {
    lat: 62.101,
    lng: 7.206,
    name: "Geiranger, Norway",
    thumb: "/demo/fjords-1.jpg",
  }),
  demoSession("sahara", "Trans-Sahara highway", 3, 5, "2026-06-12T00:00:00.000Z", {
    lat: 30.5707,
    lng: 2.88,
    name: "El Goléa, Algeria",
    thumb: "/demo/sahara-1.jpg",
  }),
  demoSession(
    "patagonia",
    "Patagonia ridgelines",
    5,
    11,
    "2026-06-10T00:00:00.000Z",
    {
      lat: -51.0,
      lng: -73.0,
      name: "Torres del Paine, Chile",
      thumb: "/demo/patagonia-1.jpg",
    },
    "completed",
  ),
  demoSession("kyoto", "Kyoto temple roads", 7, 8, "2026-06-06T00:00:00.000Z", {
    lat: 35.0036,
    lng: 135.7788,
    name: "Higashiyama, Kyoto",
    thumb: "/demo/kyoto-1.jpg",
  }),
  demoSession(
    "nyc",
    "NYC subway tiling",
    2,
    4,
    "2026-05-30T00:00:00.000Z",
    {
      lat: 40.7527,
      lng: -73.9772,
      name: "IRT Lexington Ave, NYC",
      thumb: "/demo/nyc-1.jpg",
    },
    "completed",
  ),
];

const demoLink = (from: string, to: string): SessionLink => ({
  id: `demo-link-${from}-${to}`,
  userId: "demo",
  fromSessionId: oid(from),
  toSessionId: oid(to),
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-06-01T00:00:00.000Z",
  linkType: "related",
});

export const DEMO_LINKS: SessionLink[] = [
  demoLink("tokyo", "kyoto"),
  demoLink("kyoto", "fjords"),
  demoLink("fjords", "patagonia"),
  demoLink("tokyo", "nyc"),
];

// Read-only example content shown when a guest opens a demo session, so an
// interviewer can see a populated session (globe marker, analysis, chat) without
// signing in or running the backend. Keyed by the same `demo-` ids as the nodes.
export interface DemoSessionContent {
  markers: Marker[];
  messages: Message[];
}

const BASE_TS = 1718200000000;
const chat = (lines: Array<["user" | "assistant", string]>): Message[] =>
  lines.map(([role, text], i) => ({
    id: `demo-msg-${i}`,
    role,
    text,
    ts: BASE_TS + i * 60000,
    type: "normal",
  }));

const DEMO_CONTENT_BY_SLUG: Record<string, DemoSessionContent> = {
  "tokyo": {
    markers: [
      {
        latitude: 35.6595,
        longitude: 139.7005,
        accuracy: 0.93,
        name: "Nonbei Yokocho, Shibuya",
        facts:
          "A tightly packed alley of two-story izakaya, vertical kanji signage, and red paper lanterns. The narrow lane width, overhead utility lines, and the JR rail embankment at the end of the street point to Nonbei Yokocho in Shibuya, Tokyo.",
        mapillary_images: ["/demo/tokyo-1.jpg"],
        clues: [
          { sign: "Vertical kanji signage", implies: "Dense urban Japan" },
          { sign: "Red paper lanterns", implies: "Izakaya nightlife alley" },
          { sign: "JR rail embankment at the lane's end", implies: "Beside the Yamanote tracks" },
          { sign: "~1.5 m lane width", implies: "Nonbei Yokocho, not Golden Gai" },
        ],
      },
      {
        latitude: 35.6936,
        longitude: 139.6995,
        accuracy: 0.41,
        name: "Omoide Yokocho, Shinjuku",
        facts:
          "Another lantern-lit warren of yakitori counters with the same alley width, ruled slightly lower because the JR embankment in frame sits beside Nonbei Yokocho, not here.",
        mapillary_images: [],
      },
      {
        latitude: 35.694,
        longitude: 139.7045,
        accuracy: 0.22,
        name: "Golden Gai, Shinjuku",
        facts:
          "A denser block of tiny bars, but its facades are narrower and more uniform and it sits away from the rail line.",
        mapillary_images: [],
      },
    ],
    messages: chat([
      ["assistant", "Starting from the wide signals: script, building scale, and street furniture."],
      [
        "assistant",
        "The signage is vertical kanji and the buildings are tight 2-3 story frontages packed wall to wall. That reads as dense urban Japan rather than China or Korea.",
      ],
      [
        "assistant",
        "Red paper lanterns over nearly every doorway and a lane barely 1.5 m wide point to an izakaya nightlife alley, not a regular shopping street.",
      ],
      [
        "assistant",
        "A raised JR rail embankment closes off the far end of the lane. In Tokyo, a lantern alley hard against the Yamanote tracks is a strong signature.",
      ],
      ["assistant", "Best estimate: Nonbei Yokocho, Shibuya. Confidence 93%."],
      ["user", "What ruled out Shinjuku's Golden Gai?"],
      [
        "assistant",
        "Golden Gai sits away from the tracks and its facades are narrower and more uniform. The visible rail embankment and the lantern style here match Nonbei Yokocho, which runs right beside the Yamanote line.",
      ],
      ["user", "Could it be Omoide Yokocho?"],
      [
        "assistant",
        "It's the closest alternate and shares the look, but Omoide Yokocho is a yakitori lane on the west side of Shinjuku station; the embankment geometry and lantern spacing fit Nonbei better, so I keep it second.",
      ],
    ]),
  },
  "kyoto": {
    markers: [
      {
        latitude: 35.0036,
        longitude: 135.7788,
        accuracy: 0.88,
        name: "Higashiyama, Kyoto",
        facts:
          "A stone-paved sloped lane lined with wooden machiya townhouses, with a glimpse of a pagoda above the rooflines. The preserved streetscape and gentle gradient indicate the Higashiyama approach to Kiyomizu-dera in Kyoto.",
        mapillary_images: ["/demo/kyoto-1.jpg"],
        clues: [
          { sign: "Hand-set stone paving", implies: "Heritage preservation district" },
          { sign: "Unpainted timber machiya", implies: "Kyoto townhouses" },
          { sign: "Pagoda finial above the roofs", implies: "Kiyomizu-dera approach" },
          { sign: "Steady uphill gradient", implies: "Higashiyama slope" },
        ],
      },
      {
        latitude: 34.9968,
        longitude: 135.7807,
        accuracy: 0.39,
        name: "Sannenzaka, Kyoto",
        facts:
          "The neighbouring preserved slope toward Kiyomizu, with the same paving and machiya, but its steps and shopfront spacing differ from the frame.",
        mapillary_images: [],
      },
      {
        latitude: 34.679,
        longitude: 135.827,
        accuracy: 0.14,
        name: "Naramachi, Nara",
        facts:
          "Shares the timber-townhouse look, but Nara's old town is flatter and lacks the uphill gradient toward a pagoda.",
        mapillary_images: [],
      },
    ],
    messages: chat([
      ["assistant", "Reading the paving, building materials, and what's on the skyline."],
      [
        "assistant",
        "The lane is hand-set stone, not asphalt, lined with unpainted timber machiya townhouses. That's a protected heritage streetscape, which narrows it to a few cities.",
      ],
      [
        "assistant",
        "Above the rooflines there's a multi-tier pagoda finial, and the whole lane climbs at a steady gradient toward it.",
      ],
      [
        "assistant",
        "A preserved sloped approach rising to a pagoda is the Kiyomizu-dera route through Higashiyama in Kyoto.",
      ],
      ["assistant", "Best estimate: Higashiyama, Kyoto. Confidence 88%."],
      ["user", "Could this be Nara instead?"],
      [
        "assistant",
        "Nara's old town (Naramachi) is flatter and its temple roofs differ. The steady climb toward a three-story pagoda is specific to the Kiyomizu approach, so Nara stays a distant third.",
      ],
      ["user", "Sannenzaka or the main approach?"],
      [
        "assistant",
        "Sannenzaka is the neighbouring stepped slope and a strong second; the shopfront spacing and the lack of formal steps here lean toward the main Higashiyama lane.",
      ],
    ]),
  },
  "fjords": {
    markers: [
      {
        latitude: 62.101,
        longitude: 7.206,
        accuracy: 0.81,
        name: "Geiranger, Norway",
        facts:
          "Steep glacier-carved valley walls drop to deep blue water, with scattered red-painted cabins and a switchback road guarded by stone-topped barriers. The vegetation line and fjord geometry match the Geiranger area in western Norway.",
        mapillary_images: ["/demo/fjords-1.jpg"],
        clues: [
          { sign: "U-shaped glacial valley", implies: "Western Norway fjord" },
          { sign: "Turquoise meltwater", implies: "Glacier-fed" },
          { sign: "Red falu-painted cabins", implies: "Scandinavian build" },
          { sign: "Switchback road guardrails", implies: "Geiranger tourist route" },
        ],
      },
      {
        latitude: 60.88,
        longitude: 6.88,
        accuracy: 0.44,
        name: "Nærøyfjord, Norway",
        facts:
          "A narrower UNESCO fjord with the same glacial walls; the waterfall placement and switchback profile favour Geiranger.",
        mapillary_images: [],
      },
      {
        latitude: 59.0,
        longitude: 6.3,
        accuracy: 0.19,
        name: "Lysefjord, Norway",
        facts:
          "Similar sheer walls but its cliffs are more vertical and it lacks the road switchbacks visible in frame.",
        mapillary_images: [],
      },
    ],
    messages: chat([
      ["assistant", "Working from the landform first, then the human details."],
      [
        "assistant",
        "A U-shaped glacial valley with near-vertical walls drops straight into deep water, and the water is the milky turquoise of glacial meltwater. Classic western Norway.",
      ],
      [
        "assistant",
        "Red falu-painted cabins and a switchback road with stone-topped guardrails confirm a Scandinavian fjord with a built-up tourist route.",
      ],
      [
        "assistant",
        "The waterfall placement on the far wall and the tight switchback profile match the Geiranger area specifically.",
      ],
      ["assistant", "Best estimate: Geiranger, Norway. Confidence 81%."],
      ["user", "How confident on Geiranger vs Nærøyfjord?"],
      [
        "assistant",
        "Moderate, which is why it's 81%. Nærøyfjord is a narrower UNESCO twin that shares the walls and water, but its road and waterfall layout differ from the frame. Geiranger fits best; Nærøyfjord is runner-up.",
      ],
      ["user", "Why not Lysefjord?"],
      [
        "assistant",
        "Lysefjord's cliffs are more sheer and it lacks the visible switchback road in frame, so it sits well behind the other two.",
      ],
    ]),
  },
  "sahara": {
    markers: [
      {
        latitude: 30.5707,
        longitude: 2.88,
        accuracy: 0.72,
        name: "El Goléa, Algeria",
        facts:
          "A paved road skirts a Saharan oasis settlement: date palms, a whitewashed mud-brick ksar, and a low sand ridge under a hard blue sky. The pole lighting, red-and-white kerb striping, and architecture place it in the central Algerian Sahara near El Goléa.",
        mapillary_images: ["/demo/sahara-1.jpg"],
        streetView: false,
        clues: [
          { sign: "Date palms around a whitewashed ksar", implies: "Saharan oasis town" },
          { sign: "Red-and-white kerb striping", implies: "Maghreb road standard" },
          { sign: "Pole-mounted highway lighting", implies: "Algerian trunk road" },
          { sign: "Hard blue sky over a low sand ridge", implies: "Deep central Sahara" },
        ],
      },
      {
        latitude: 29.26,
        longitude: 0.23,
        accuracy: 0.34,
        name: "Timimoun, Algeria",
        facts:
          "A red-earth Saharan oasis with similar palms and ksar architecture; its buildings run a deeper ochre than the whitewashed frame.",
        mapillary_images: [],
      },
      {
        latitude: 32.49,
        longitude: 3.67,
        accuracy: 0.16,
        name: "Ghardaïa, Algeria",
        facts:
          "Another M'zab valley oasis town, but its tiered hillside layout differs from the flat roadside scene.",
        mapillary_images: [],
      },
    ],
    messages: chat([
      ["assistant", "Reading vegetation, architecture, and road furniture together."],
      [
        "assistant",
        "Date palms ring a whitewashed mud-brick ksar beside a paved road, under a hard blue sky with a low sand ridge behind. A Saharan oasis settlement, not a coastal town.",
      ],
      [
        "assistant",
        "The red-and-white kerb striping, pole-mounted lighting, and asphalt standard are Maghreb road conventions, and the lean is Algerian.",
      ],
      [
        "assistant",
        "The ksar form plus a deep-desert setting (no relief, no coast) points to the central Algerian oases around El Goléa.",
      ],
      ["assistant", "Best estimate: El Goléa, Algeria. Confidence 72%."],
      ["user", "What ruled out Morocco or Tunisia?"],
      [
        "assistant",
        "Moroccan kasbahs run an earthier red and sit against the Atlas foothills; Tunisia's southern towns are nearer the coast. The whitewash and flat horizon fit Algeria, though it's a lower-confidence call at 72%.",
      ],
      ["user", "Timimoun is red-earth though, right?"],
      [
        "assistant",
        "It is, and Timimoun is my second guess, but its buildings run a deeper ochre than the whitewashed frame here, so El Goléa edges it.",
      ],
    ]),
  },
  "patagonia": {
    markers: [
      {
        latitude: -51.0,
        longitude: -73.0,
        accuracy: 0.85,
        name: "Torres del Paine, Chile",
        facts:
          "Jagged granite spires rise over windswept golden grassland with a turquoise glacial lake below. The horn-shaped peaks and guanaco-grazed steppe are signatures of Torres del Paine in Chilean Patagonia.",
        mapillary_images: ["/demo/patagonia-1.jpg"],
        streetView: false,
        clues: [
          { sign: "Sheer granite towers", implies: "Southern Patagonia" },
          { sign: "Treeless golden steppe", implies: "Windswept plateau" },
          { sign: "Milky-blue glacial lake", implies: "Glacier-fed basin" },
          { sign: "Three-horn 'Torres' silhouette", implies: "Chilean national park" },
        ],
      },
      {
        latitude: -49.3,
        longitude: -73.05,
        accuracy: 0.37,
        name: "Los Glaciares, Argentina",
        facts:
          "The same granite-and-steppe palette across the border; the three-tower 'Torres' silhouette in frame is the Chilean park, not here.",
        mapillary_images: [],
      },
      {
        latitude: -49.27,
        longitude: -72.99,
        accuracy: 0.18,
        name: "Cerro Fitz Roy, El Chaltén",
        facts:
          "A famous spire cluster with similar lakes, but its peak profile is sharper and singular versus the broad horns shown.",
        mapillary_images: [],
      },
    ],
    messages: chat([
      ["assistant", "Matching the peak silhouette, the vegetation, and the water colour."],
      [
        "assistant",
        "Sheer granite towers rise straight out of treeless golden steppe, with a milky-blue glacial lake below. That trio is unmistakably southern Patagonia.",
      ],
      [
        "assistant",
        "The grazed, windswept grassland and the glacier-fed lake colour rule out the wetter, forested parts of the range.",
      ],
      [
        "assistant",
        "The distinctive three-horn 'Torres' profile is the signature of Torres del Paine.",
      ],
      ["assistant", "Best estimate: Torres del Paine, Chile. Confidence 85%."],
      ["user", "Chilean or Argentine side?"],
      [
        "assistant",
        "Chilean. The three-tower profile and the lake's position place the viewpoint inside the Chilean park rather than across the border near El Chaltén.",
      ],
      ["user", "How is this different from Fitz Roy?"],
      [
        "assistant",
        "Fitz Roy (El Chaltén, Argentina) is a sharper single spire cluster; the broad three-horn massif and the foreground lake here are Paine, so Fitz Roy is a lower-ranked alternate.",
      ],
    ]),
  },
  "nyc": {
    markers: [
      {
        latitude: 40.7527,
        longitude: -73.9772,
        accuracy: 0.79,
        name: "IRT Lexington Ave, NYC",
        facts:
          "Yellow tactile warning tiles along the platform edge, riveted steel I-beam columns, and the track and third-rail layout identify the New York City subway. The platform construction points to an original IRT Lexington Avenue line station in Manhattan.",
        mapillary_images: ["/demo/nyc-1.jpg"],
        clues: [
          { sign: "Yellow tactile edge tiles", implies: "NYC subway platform" },
          { sign: "Riveted steel I-beam columns", implies: "IRT-era construction" },
          { sign: "Cut-and-cover track layout", implies: "Original Lexington line" },
          { sign: "Narrow column spacing", implies: "Manhattan local stop" },
        ],
      },
      {
        latitude: 40.758,
        longitude: -73.9855,
        accuracy: 0.36,
        name: "BMT Broadway Line, NYC",
        facts:
          "Same NYC subway build era, but its platforms are wider with different column spacing than the IRT shown.",
        mapillary_images: [],
      },
      {
        latitude: 40.7527,
        longitude: -73.9908,
        accuracy: 0.17,
        name: "IND Eighth Ave Line, NYC",
        facts:
          "A later cut-and-cover line; its tiling palette and signage typography don't match the riveted IRT columns in frame.",
        mapillary_images: [],
      },
    ],
    messages: chat([
      ["assistant", "Inspecting the tiling, the column type, and the track layout."],
      [
        "assistant",
        "Yellow cast-iron tactile tiles run along the platform edge, the columns are riveted steel I-beams, and the tracks sit in a shallow cut-and-cover box. That's the New York City subway.",
      ],
      [
        "assistant",
        "Riveted steel columns at that spacing are the early IRT build rather than the later, wider IND or BMT lines.",
      ],
      [
        "assistant",
        "Putting that together points to the original IRT Lexington Avenue line in Manhattan.",
      ],
      ["assistant", "Best estimate: IRT Lexington Ave, NYC. Confidence 79%."],
      ["user", "Which station, roughly?"],
      [
        "assistant",
        "The platform width and column spacing suggest a Grand Central-area local stop, but restoration across the line keeps this to a station group rather than an exact platform.",
      ],
      ["user", "Could it be the BMT Broadway line?"],
      [
        "assistant",
        "BMT platforms are wider with different column spacing, so it's my second guess but a step behind the IRT read.",
      ],
    ]),
  },
};

// Keyed by the same opaque session ids used on the globe + in the URL.
export const DEMO_SESSION_CONTENT: Record<string, DemoSessionContent> =
  Object.fromEntries(
    Object.entries(DEMO_CONTENT_BY_SLUG).map(([slug, content]) => [oid(slug), content]),
  );
