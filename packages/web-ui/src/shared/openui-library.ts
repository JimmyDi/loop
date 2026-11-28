import { openuiChatLibrary, openuiLibrary } from "@openuidev/react-ui/genui-lib";

import { scenarioComponents } from "./openui-scenarios";
import type { ScenarioTopic } from "./openui-topics";

export const openUiLibrary = openuiLibrary.extend!({
  components: {
    add: [
      ...Object.values(openuiChatLibrary.components).filter(
        ({ name }) => !Object.hasOwn(openuiLibrary.components, name),
      ),
      ...Object.values(scenarioComponents).map(({ definition }) => definition),
    ],
  },
});

export const openUiTopicComponents = new Map<ScenarioTopic, string[]>();
for (const { definition, topics } of Object.values(scenarioComponents)) {
  for (const topic of topics) {
    const names = openUiTopicComponents.get(topic) ?? [];
    names.push(definition.name);
    openUiTopicComponents.set(topic, names);
  }
}
