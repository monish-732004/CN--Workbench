/** "How to answer" guidance for every question type. Shown when the Guide switch is on. */
export interface Guide {
  title: string;
  steps: string[];
  tip?: string;
}

export const GUIDES: Record<string, Guide> = {
  delayline: {
    title: "Latency timeline",
    steps: ["Work out propagation time (distance ÷ speed) and transmission time (bits ÷ bandwidth).", "Type both in milliseconds and press Check under them.", "Add every delay for the total latency and check it.", "Click the coloured segment that is largest on the timeline, then check."],
    tip: "1 KB = 1000 bytes here; multiply bytes by 8 to get bits.",
  },
  pinout: {
    title: "RJ-45 crimping",
    steps: ["If asked, pick the cable type first (straight, crossover or rollover) and check it.", "Click a wire in the tray to pick it up.", "Click a pin slot (1 to 8, left to right) to drop it there. Click a placed wire to move it.", "When all 8 pins are filled, press Check."],
  },
  bitbench: {
    title: "Bit bench",
    steps: ["Move the prefix boundary with the arrows or slider until the mask row matches the given mask.", "In the Network row, flip host bits (shaded) so they are all 0.", "In the Broadcast row, flip host bits so they are all 1.", "Enter the number of addresses and usable hosts, then check each step."],
    tip: "Never change bits to the left of the boundary.",
  },
  slicer: {
    title: "VLSM address bar",
    steps: ["Set a prefix for every network with − and + (smallest block that fits), then check sizing.", "Press Place on a row, then click on the address bar where the block should start.", "Fill first host, last host and broadcast for each network.", "Check placement and host ranges."],
    tip: "Largest network first, each starting at the lowest free address.",
  },
  fib: {
    title: "Forwarding table",
    steps: ["Click a packet card to select it.", "Click the interface it should leave from, or Drop if nothing matches.", "Repeat for every packet, then press Check."],
    tip: "The table is not sorted: pick the matching route with the longest prefix.",
  },
  spf: {
    title: "Dijkstra stepper",
    steps: ["Starting from the blue root, click nodes in the order they join the shortest-path tree.", "Use Undo last pick if you click the wrong node.", "Enter the shortest distance to every node (and its next hop if asked).", "Check each part separately."],
  },
  vectors: {
    title: "RIP update",
    steps: ["Compare each destination in the received table with the router's own table.", "Choose Keep, Replace or Add for each row.", "Set the next router and the new cost (received cost + 1 hop).", "Press Check when every row has an action and a cost."],
  },
  crc: {
    title: "CRC long division",
    steps: ["In each step, choose the divisor when the leading bit is 1, or all zeros when it is 0.", "Click result bits to flip them so they show the XOR result.", "The next bit comes down automatically into the next step.", "Enter the remainder bits and the full codeword, then check."],
  },
  hamming: {
    title: "Hamming grid",
    steps: ["Click Role to mark parity positions (P) at powers of two.", "Click each Bit cell to set 0 or 1 for the full codeword.", "For the receiver, set each syndrome bit, click the received bit that is wrong, and set the dataword."],
    tip: "Positions count from the right: position 1 is the rightmost bit.",
  },
  hexdump: {
    title: "Hex dump dissector",
    steps: ["Pick a field name, click its first byte, then its last byte.", "Repeat for every field and check the boundaries.", "Convert each field to decimal and check.", "Choose the application, direction and segment role, then check."],
  },
  ladder: {
    title: "TCP ladder",
    steps: ["For each row, choose the segment type from the list.", "Click the arrow to flip it between client → server and server → client.", "Enter SEQ and ACK numbers. Leave ACK empty when there is none.", "Check the order first, then the numbers."],
  },
  sorter: {
    title: "Sort into buckets",
    steps: ["Click an item (or drag it) to pick it up.", "Click the bucket it belongs to (or drop it there).", "To move an item, click it again and choose another bucket; the × returns it to the tray.", "When the tray is empty, press Check."],
  },
  sequence: {
    title: "Put steps in order",
    steps: ["Drag a step by its handle, or use the up and down arrows.", "Put the first step at the top.", "Press Check when the list is in order."],
  },
  form: {
    title: "Calculation workbench",
    steps: ["Read the given values in the grey box.", "Type each answer in its box (choose from the list where there is one).", "Each section has its own Check button."],
    tip: "Use the units shown next to each box.",
  },
  table: {
    title: "Event table",
    steps: ["Read the rules under the question; they decide every answer.", "Work through the rows from top to bottom: each row is one event.", "Fill every answer cell (— means nothing to fill), then press Check."],
  },
  stuffing: {
    title: "Bit stuffing",
    steps: ["Scan the data from the left and count consecutive 1s.", "After every fifth 1 in a row, click the gap that follows it to insert a stuffed 0.", "For a received stream, click each stuffed 0 to remove it.", "Check each part."],
  },
  "custom:mcq": { title: "Multiple choice", steps: ["Read the question.", "Click the one correct option.", "Press Check."] },
  "custom:msq": { title: "Multiple select", steps: ["Read the question.", "Click every option that is correct (more than one may be).", "Press Check."] },
  "custom:numeric": { title: "Numeric answer", steps: ["Your numbers differ from your neighbours'.", "Calculate and type the answer in the box (units shown beside it).", "Press Check."] },
  "custom:text": { title: "Short answer", steps: ["Type a short answer in the box.", "Capital letters and extra spaces don't matter.", "Press Check."] },
  "custom:order": { title: "Order the steps", steps: ["Drag steps or use the arrows.", "First step at the top.", "Press Check."] },
};

export function guideFor(templateId: string, customType?: string): Guide | null {
  if (templateId === "custom" && customType) return GUIDES[`custom:${customType}`] ?? null;
  return GUIDES[templateId] ?? null;
}
