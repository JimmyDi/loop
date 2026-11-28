import { z } from "zod";

import { demoSalesQuery } from "../shared/openui-sales-data";

import { scenarioTopicSchema } from "../shared/openui-topics";

const topicGuidanceSchema = z.strictObject({
  useFor: z.string().trim().min(1),
  notes: z.string().trim().min(1),
  example: z.string().trim().min(1),
});

export const scenarioTopicGuidance = z.record(scenarioTopicSchema, topicGuidanceSchema).parse({
  maps: {
    useFor: "interactive maps and routes",
    notes:
      "Use named stops with verified or user-provided coordinates. Optional route coordinates show existing route geometry; omit them if no route source is available. Use plain stop names without numbering and put the route title in the card only. The card can request a walking route on click; if no geometry is supplied, point to that control instead of saying the route is unavailable.",
    example:
      'root = Stack([RouteMap("Harbor walk", [{name: "Ferry Building", longitude: -122.3933, latitude: 37.7955}])])',
  },
  guides: {
    useFor: "illustrated step-through instructions",
    notes:
      "Use variants for configurations or sizes. Illustrate what changes between steps with simple SVG path strings in the view box. Preserve any supplied manual instructions.",
    example:
      'root = Stack([StepGuide("Assembly", [{name: "Small", steps: [{title: "Align", description: "Align the edges", diagram: ["M40 40 H160 V140"]}, {title: "Attach", description: "Follow the manual"}]}])])',
  },
  cooking: {
    useFor: "ingredient scaling and timers",
    notes:
      "Supply ingredient quantities for the stated base servings. For timed stages, use Countdown with an explicit duration in seconds. Place Countdown directly under Stack. For a recipe, list each step in a separate Card or use Steps, and keep the countdown in the same Stack.",
    example:
      'root = Stack([ScaledList("Shopping list", 4, [{name: "Rice", amount: 300, unit: "g"}]), rest])\nrest = Stack([Card([CardHeader("Rest"), TextContent("Let the dish rest before serving.")]), Countdown("Rest timer", 600)])',
  },
  images: {
    useFor: "mood boards, color palettes and clickable photo searches",
    notes:
      "Use ColorSwatch for each palette color so its actual color and hex value are visible. For clickable photo searches, use one SearchImage per query to show results in chat. Use a concise public Wikimedia Commons search phrase without private data. Use Image for a supplied photo URL.",
    example:
      'root = Stack([Stack([ColorSwatch("Moss green", "#5E7A4B", "Ground cover")], "row"), SearchImage("Garden references", "Japanese moss garden")])',
  },
  sales: {
    useFor: "sales what-if sliders",
    notes:
      "Use actual values supplied by the user or an available agent tool. If the user asks for demo data, label the values as synthetic. The slider applies a percentage change to the supplied values locally. For the built-in synthetic USD dataset, use Query with the literal tool name " +
      demoSalesQuery +
      " and an empty argument object. Do not add a refresh interval.",
    example:
      'root = Stack([SalesScenario("Demo sales (synthetic)", "USD", data.rows)])\ndata = Query("' +
      demoSalesQuery +
      '", {})',
  },
  music: {
    useFor: "playable percussion",
    notes: "Use the sequencer when the user asks for a playable drum lab or editable drum pattern.",
    example: 'root = Stack([DrumLab("Drum lab", 100)])',
  },
});
