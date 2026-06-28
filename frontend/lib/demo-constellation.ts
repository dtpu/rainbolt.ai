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

const demoSession = (
  id: string,
  title: string,
  images: number,
  chats: number,
  lastAccessedAt: string,
  place: DemoPlace,
  status: "active" | "completed" = "active",
): GlobeSessionWithData => ({
  id: `demo-${id}`,
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
  fromSessionId: `demo-${from}`,
  toSessionId: `demo-${to}`,
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

export const DEMO_SESSION_CONTENT: Record<string, DemoSessionContent> = {
  "demo-tokyo": {
    markers: [
      {
        latitude: 35.6595,
        longitude: 139.7005,
        accuracy: 0.93,
        name: "Nonbei Yokocho, Shibuya",
        facts:
          "A tightly packed alley of two-story izakaya, vertical kanji signage, and red paper lanterns. The narrow lane width, overhead utility lines, and the JR rail embankment at the end of the street point to Nonbei Yokocho in Shibuya, Tokyo.",
        mapillary_images: ["/demo/tokyo-1.jpg"],
      },
    ],
    messages: chat([
      [
        "assistant",
        "Analyzing the street scene: signage, architecture, road furniture.",
      ],
      [
        "assistant",
        "Vertical kanji, compact 2 to 3 story buildings, and dense bar frontage read as urban Japan. Red lanterns and the alley width narrow it to a Tokyo nightlife lane.",
      ],
      ["assistant", "Best estimate: Nonbei Yokocho, Shibuya. Confidence 93%."],
      ["user", "What ruled out Shinjuku's Golden Gai?"],
      [
        "assistant",
        "The JR Yamanote embankment visible at the end of the alley and the lantern signage style match Nonbei Yokocho; Golden Gai sits away from the tracks and has narrower, more uniform facades.",
      ],
    ]),
  },
  "demo-kyoto": {
    markers: [
      {
        latitude: 35.0036,
        longitude: 135.7788,
        accuracy: 0.88,
        name: "Higashiyama, Kyoto",
        facts:
          "A stone-paved sloped lane lined with wooden machiya townhouses, with a glimpse of a pagoda above the rooflines. The preserved streetscape and gentle gradient indicate the Higashiyama approach to Kiyomizu-dera in Kyoto.",
        mapillary_images: ["/demo/kyoto-1.jpg"],
      },
    ],
    messages: chat([
      ["assistant", "Reading paving, building materials, and skyline cues."],
      [
        "assistant",
        "Hand-set stone paving and unpainted timber machiya are heritage-district Japan; the pagoda finial above the roofs places it in Kyoto.",
      ],
      [
        "assistant",
        "Best estimate: Higashiyama, near Kiyomizu-dera. Confidence 88%.",
      ],
      ["user", "Could this be Nara instead?"],
      [
        "assistant",
        "Nara's old town is flatter and its temple roofs differ; the consistent uphill gradient toward a three-story pagoda is the Kiyomizu approach.",
      ],
    ]),
  },
  "demo-fjords": {
    markers: [
      {
        latitude: 62.101,
        longitude: 7.206,
        accuracy: 0.81,
        name: "Geiranger, Norway",
        facts:
          "Steep glacier-carved valley walls drop to deep blue water, with scattered red-painted cabins and a switchback road guarded by stone-topped barriers. The vegetation line and fjord geometry match the Geiranger area in western Norway.",
        mapillary_images: ["/demo/fjords-1.jpg"],
      },
    ],
    messages: chat([
      ["assistant", "Assessing landform, water colour, and road engineering."],
      [
        "assistant",
        "U-shaped glacial valley, near-vertical walls, and turquoise meltwater are classic western Norway. Red falu cabins and switchback guardrails support a fjord tourist route.",
      ],
      ["assistant", "Best estimate: Geiranger fjord. Confidence 81%."],
      ["user", "How confident on Geiranger vs. Nærøyfjord?"],
      [
        "assistant",
        "Moderate. The waterfall placement and the road's switchback profile favour Geiranger, but a few other Sunnmøre fjords share this look, hence 81%.",
      ],
    ]),
  },
  "demo-sahara": {
    markers: [
      {
        latitude: 30.5707,
        longitude: 2.88,
        accuracy: 0.72,
        name: "El Goléa, Algeria",
        facts:
          "A paved road skirts a Saharan oasis settlement: date palms, a whitewashed mud-brick ksar, and a low sand ridge under a hard blue sky. The pole lighting, red-and-white kerb striping, and architecture place it in the central Algerian Sahara near El Goléa.",
        mapillary_images: ["/demo/sahara-1.jpg"],
      },
    ],
    messages: chat([
      ["assistant", "Reading vegetation, building style, and road furniture."],
      [
        "assistant",
        "Date palms with a whitewashed ksar and red-and-white kerb striping read as a Saharan oasis town in the Maghreb. Pole-mounted lighting and the asphalt standard lean Algerian.",
      ],
      [
        "assistant",
        "Best estimate: El Goléa, central Algeria. Confidence 72%.",
      ],
      ["user", "What ruled out Morocco or Tunisia?"],
      [
        "assistant",
        "The ksar form and deep-desert setting fit Algeria's central oases; Moroccan kasbahs run earthier red and Tunisia's southern towns sit nearer the coast.",
      ],
    ]),
  },
  "demo-patagonia": {
    markers: [
      {
        latitude: -51.0,
        longitude: -73.0,
        accuracy: 0.85,
        name: "Torres del Paine, Chile",
        facts:
          "Jagged granite spires rise over windswept golden grassland with a turquoise glacial lake below. The horn-shaped peaks and guanaco-grazed steppe are signatures of Torres del Paine in Chilean Patagonia.",
        mapillary_images: ["/demo/patagonia-1.jpg"],
      },
    ],
    messages: chat([
      ["assistant", "Matching peak silhouette, vegetation, and water colour."],
      [
        "assistant",
        "Sheer granite towers over treeless steppe with milky-blue glacial lakes is unmistakably southern Patagonia.",
      ],
      ["assistant", "Best estimate: Torres del Paine, Chile. Confidence 85%."],
      ["user", "Chilean or Argentine side?"],
      [
        "assistant",
        "Chilean. The three-tower 'Torres' profile and the lake's position place the viewpoint inside the Chilean national park rather than near El Chaltén.",
      ],
    ]),
  },
  "demo-nyc": {
    markers: [
      {
        latitude: 40.7527,
        longitude: -73.9772,
        accuracy: 0.79,
        name: "IRT Lexington Ave, NYC",
        facts:
          "Yellow tactile warning tiles along the platform edge, riveted steel I-beam columns, and the track and third-rail layout identify the New York City subway. The platform construction points to an original IRT Lexington Avenue line station in Manhattan.",
        mapillary_images: ["/demo/nyc-1.jpg"],
      },
    ],
    messages: chat([
      ["assistant", "Inspecting tile, column type, and signage typography."],
      [
        "assistant",
        "Yellow cast-iron tactile edge tiles, riveted steel columns, and the cut-and-cover track layout are the NYC subway's IRT-era build.",
      ],
      [
        "assistant",
        "Best estimate: IRT Lexington Avenue line, Manhattan. Confidence 79%.",
      ],
      ["user", "Which station, roughly?"],
      [
        "assistant",
        "The platform width and column spacing suggest a Grand Central area local stop, though restoration across the line keeps this to a station group, not an exact platform.",
      ],
    ]),
  },
};
