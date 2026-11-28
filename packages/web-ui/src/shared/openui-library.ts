import { openuiChatLibrary, openuiLibrary } from "@openuidev/react-ui/genui-lib";

// The standalone library supplies layouts and modals. Add the chat-only components
// so they are available inside Stack as well.
export const openUiLibrary = openuiLibrary.extend!({
  components: {
    add: Object.values(openuiChatLibrary.components).filter(
      ({ name }) => !Object.hasOwn(openuiLibrary.components, name),
    ),
  },
});
