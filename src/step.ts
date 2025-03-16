import * as vscode from "vscode";
import * as child_process from 'child_process';
import * as fs from "fs";

const tmpFileName = "/tmp/ochaTmpFile";
const tmpMlFileName = tmpFileName + ".ml";
const tmpCmiFileName = tmpFileName + ".cmi";

const redexType = vscode.window.createTextEditorDecorationType({
  backgroundColor: 'rgba(184, 235, 184, 0.8)',
  // border: '1px solid red',
  // the following does not work...
  // textDecoration: 'none; display none;'
  // the following work but with space remaining
  // textDecoration: 'none',
  // color: 'transparent',
  // backgroundColor: 'transparent',
  // opacity: '0'
});

const reductType = vscode.window.createTextEditorDecorationType({
  backgroundColor: 'rgba(221, 160, 221, 0.6)',
});

const refEnvType = vscode.window.createTextEditorDecorationType({
  backgroundColor: 'rgba(223, 228, 245, 0.6)',
});

const printedType = vscode.window.createTextEditorDecorationType({
  backgroundColor: 'rgba(255, 192, 203, 0.6)',
});

// whether stepper is installed or not
let stepperInstalled: boolean = false;

// step execution history (for prev button)
let history: string[] = [];

// the current program
let currentProgram: string = "";

// the next program to be step executed
let nextProgram: string = "";

// whether the last command was previous
let afterPrev = 0;

// whether shown step is a skip
let currentlySkip = 0;

// document for showing the current step
let stepperDocument: vscode.TextDocument;

// called once when the extension is activated
export async function activate(context: vscode.ExtensionContext) {
  console.log('"ocha.step" is now active!');

  // the commands have been defined in the package.json file
  const stepperStartCommand = vscode.commands.registerCommand(
    "Ocha.stepper.start", () => { stepperStart(); }
  );
  context.subscriptions.push(stepperStartCommand);

  const stepperNextCommand = vscode.commands.registerCommand(
    "Ocha.stepper.next", () => { stepperNext("next"); }
  );
  context.subscriptions.push(stepperNextCommand);

  const stepperPrevCommand = vscode.commands.registerCommand(
    "Ocha.stepper.prev", () => { stepperPrev(); }
  );
  context.subscriptions.push(stepperPrevCommand);

  const stepperSkipCommand = vscode.commands.registerCommand(
    "Ocha.stepper.skip", () => { stepperNext("skip"); }
  );
  context.subscriptions.push(stepperSkipCommand);

  const stepperForwardCommand = vscode.commands.registerCommand(
    "Ocha.stepper.forward", () => { stepperNext("nextitem"); }
  );
  context.subscriptions.push(stepperForwardCommand);

  const stepperEndCommand = vscode.commands.registerCommand(
    "Ocha.stepper.end", () => { stepperEnd(); }
  );
  context.subscriptions.push(stepperEndCommand);

  // check if a stepper is installed
  try {
    child_process.execSync("stepper -version");
    stepperInstalled = true;
  } catch (error) {
    console.log("stepper is not installed");
  }
}

// called once when the extension is deactivated
export function deactivate() { }

// called when "Ocha.stepper.start" is executed
async function stepperStart() {
  if (!stepperInstalled) {
    vscode.window.showInformationMessage("Stepper not installed.");
    return;
  }
  if (history.length > 0) {
    vscode.window.showInformationMessage("Stepper is already running.");
    return;
  }

  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  if (editor.document.isDirty) {
    const result = await editor.document.save();
    if (!result) return;
  }

  // absolute path of the file to be step executed
  const path = editor.document.uri.path;

  // execute stepper
  const text = executeStepper("next", path);
  if (!text) return;

  // create a stepper document
  stepperDocument = await vscode.workspace.openTextDocument({
    content: "a stepper document to show a step",
    language: 'ocaml'
  });

  // show a step
  showStep(text);
}

// make decorations from indexL to indexR
function makeDecoration(
  document: vscode.TextDocument,
  indexL: number,
  indexR: number
) {
  const decorations = [];
  const startPos = document.positionAt(indexL);
  const endPos = document.positionAt(indexR);
  const redexDecoration = { range: new vscode.Range(startPos, endPos) };
  decorations.push(redexDecoration);
  return decorations;
}

// add decorations from indexL to indexR
function addDecoration(
  decorations: { range: vscode.Range; }[],
  document: vscode.TextDocument,
  indexL: number,
  indexR: number
) {
  const startPos = document.positionAt(indexL);
  const endPos = document.positionAt(indexR);
  const redexDecoration = { range: new vscode.Range(startPos, endPos) };
  decorations.push(redexDecoration);
  return decorations;
}

// replace contents of the document in the editor to text
async function replaceContents(editor: vscode.TextEditor, text: string) {
  const document = editor.document;
  const fullRange = new vscode.Range(
    document.positionAt(0),
    document.positionAt(document.getText().length)
  );

  await editor.edit(editBuilder => {
    editBuilder.replace(fullRange, text);
  });
}

// execute stepper
function executeStepper(mode: string, path: string): string | undefined {
  const command = "env STEPPER_MODE=" + mode + " stepper " + path;
  // console.log(command);
  let text = child_process.execSync(command).toString();
  // console.log(text);

  const index = text.indexOf("(* Stepper Error: No more steps. *)");
  if (index >= 0) {
    vscode.window.showInformationMessage("No more steps.");
    return;
  }

  // remove (* from Step nn *)
  text = text.replace(/\(\* from Step [0-9]+ \*\)/, "")

  // remove (* forward *)
  text = text.replace(/\(\* forward \*\)/, "")

  history.push(text);
  return (text);
}

// show a step
async function showStep(text: string) {
  const parenLst = findAllMatchingParenthesis(text);
  if (!parenLst) {
    console.log(text);
    console.log("findAllMatchingParenthesis failed.");
    return;
  }
  // console.log(parenLst);

  // find first [@@@stepper.process ...]
  const stepperProcessL1 = text.indexOf("[@@@stepper.process");
  if (stepperProcessL1 === -1) {
    console.log(text);
    console.log("First stepper.process not found.");
    return;
  }
  const stepperProcessR1 = findMatchingIndex(parenLst, stepperProcessL1)!;

  // find first [@@@stepper.counter ...]
  const stepperCounter1 = text.indexOf("[@@@stepper.counter", stepperProcessL1);

  // find redex
  const redexL = text.indexOf("[@x ]", stepperCounter1);
  const redexR = redexL + "[@x ]".length - 1;
  let redexExpR = redexL - 1;
  while (text[redexExpR] !== ")") redexExpR--;
  const redexExpL = findMatchingIndex(parenLst, redexExpR)!;

  // find second [@@@stepper.process ...]
  const stepperProcessL2 = text.indexOf("[@@@stepper.process", redexL);
  if (stepperProcessL2 === -1) {
    console.log(text);
    console.log("Second stepper.process not found.");
    return;
  }
  const stepperProcessR2 = findMatchingIndex(parenLst, stepperProcessL2)!;

  // find second [@@@stepper.counter ...]
  const stepperCounter2 = text.indexOf("[@@@stepper.counter", stepperProcessL2);

  // find reduct
  const reductL = text.indexOf("[@t ]", stepperCounter2);
  const reductR = reductL + "[@t ]".length - 1;
  let reductExpR = reductL - 1;
  while (text[reductExpR] !== ")") reductExpR--;
  const reductExpL = findMatchingIndex(parenLst, reductExpR)!;

  // find first [@stepper.ref_env] if it exists
  let stepperRefEnvL1 = text.indexOf("[@stepper.ref_env]", stepperProcessR1);
  let stepperRefEnvR1;
  let refEnvL1;
  let refEnvR1;
  if (stepperRefEnvL1 === -1 || stepperRefEnvL1 > stepperProcessL2) {
    // no [@stepper.ref_env] or it is for reduct
    stepperRefEnvL1 = stepperProcessR1;
    stepperRefEnvR1 = stepperProcessR1;
    refEnvL1 = stepperProcessR1;
    refEnvR1 = stepperProcessR1;
  } else {
    // [@stepper.ref_env] exists
    stepperRefEnvR1 = stepperRefEnvL1 + "[@stepper.ref_env]".length - 1;
    refEnvR1 = stepperRefEnvL1 - 1;
    while (text[refEnvR1] !== ")") refEnvR1--;
    refEnvL1 = findMatchingIndex(parenLst, refEnvR1)!;
  }

  // find second [@stepper.ref_env] if it exists
  let stepperRefEnvL2 = text.indexOf("[@stepper.ref_env]", stepperProcessR2);
  let stepperRefEnvR2;
  let refEnvL2;
  let refEnvR2;
  if (stepperRefEnvL2 === -1) {
    // no [@stepper.ref_env]
    stepperRefEnvL2 = stepperProcessR2;
    stepperRefEnvR2 = stepperProcessR2;
    refEnvL2 = stepperProcessR2;
    refEnvR2 = stepperProcessR2;
  } else {
    // [@stepper.ref_env] exists
    stepperRefEnvR2 = stepperRefEnvL2 + "[@stepper.ref_env]".length - 1;
    refEnvR2 = stepperRefEnvL2 - 1;
    // console.log(text);
    // console.log(refEnvR2);
    while (text[refEnvR2] !== ")") refEnvR2--;
    refEnvL2 = findMatchingIndex(parenLst, refEnvR2)!;
  }

  // find first [@stepper.printed ] if it exists
  let stepperPrintedL1 = text.indexOf("[@stepper.printed ]", redexR);
  let stepperPrintedR1;
  let printedL1;
  let printedR1;
  if (stepperPrintedL1 === -1 || stepperPrintedL1 > stepperProcessL2) {
    // no [@stepper.printed ] or it is for reduct
    stepperPrintedL1 = redexR;
    stepperPrintedR1 = redexR;
    printedL1 = redexR + 1;
    printedR1 = redexR + 1;
  } else {
    // [@stepper.printed ] exists
    stepperPrintedR1 = stepperPrintedL1 + "[@stepper.printed ]".length - 1;
    printedR1 = stepperPrintedL1 - 1;
    while (text[printedR1] !== ")") printedR1--;
    printedL1 = findMatchingIndex(parenLst, printedR1)!;
  }

  // find second [@stepper.printed ] if it exists
  let stepperPrintedL2 = text.indexOf("[@stepper.printed ]", reductR);
  let stepperPrintedR2;
  let printedL2;
  let printedR2;
  if (stepperPrintedL2 === -1) {
    // no [@stepper.printed ]
    stepperPrintedL2 = text.length - 1;
    stepperPrintedR2 = text.length - 1;
    printedL2 = text.length - 1;
    printedR2 = text.length - 1;
  } else {
    // [@stepper.printed ] exists
    stepperPrintedR2 = stepperPrintedL2 + "[@stepper.printed ]".length - 1;
    printedR2 = stepperPrintedL2 - 1;
    while (text[printedR2] !== ")") printedR2--;
    printedL2 = findMatchingIndex(parenLst, printedR2)!;
  }

  /* text looks like:
    (* Step 0 *)
    [@@@stepper.process
    ^ stepperProcessL1
      [@@@stepper.counter 0]
      ^ stepperCounter1
      let a = 3 + 4]
                   ^ stepperProcessR1

    ( #1: 0,	 #2: 0)[@stepper.ref_env]
    ^               ^^ stepperRefEnvL1^ stepperRefEnvR1
    refEnvL1        refEnvR1

    let a = ((3 + 4)[@x ])
             ^     ^^   ^ redexExpL, redexExpR, redexL, redexR

    (hello)[@stepper.printed ]
    ^     ^^ stepperPrintedL1^ stepperPrintedR1
    printedL1, printedR1
    (* Step 1 *)
    [@@@stepper.process
    ^ stepperProcessL2
      [@@@stepper.counter 1]
      ^ stepperCounter2
      let a = 7]
               ^ stepperProcessR2

    ( #1: 0,	 #2: 0)[@stepper.ref_env]
    ^               ^^ stepperRefEnvL2^ stepperRefEnvR2
    refEnvL2        refEnvR2

    let a = ((7)[@t ])
             ^ ^^   ^ reductExpL, reductExpR, reductL, reductR

    (hello)[@stepper.printed ]
    ^     ^^ stepperPrintedL2^ stepperPrintedR2
    printedL2, printedR2
  */

  const first = text.substring(0, stepperProcessL1);
  const refenv1 = (refEnvL1 === refEnvR1
    ? "" : "\n" + text.substring(refEnvL1, refEnvR1 + 1) + "\n");
  const exp1 = text.substring(stepperRefEnvR1 + 2, redexExpL);
  const redex = text.substring(redexExpL + 1, redexExpR);
  const exp2 = text.substring(redexR + 1, printedL1);
  const printed1 = (printedL1 === printedR1
    ? "" : text.substring(printedL1 + 1, printedR1));
  const exp3 = text.substring(stepperPrintedR1 + 1, stepperProcessL2);
  const refenv2 = (refEnvL2 === refEnvR2
    ? "" : "\n" + text.substring(refEnvL2, refEnvR2 + 1) + "\n");
  const exp4 = text.substring(stepperRefEnvR2 + 2, reductExpL);
  const reduct = text.substring(reductExpL + 1, reductExpR);
  const exp5 = text.substring(reductR + 1, printedL2);
  const printed2 = (printedL2 === printedR2
    ? "" : text.substring(printedL2 + 1, printedR2));
  // console.log([
  //   first, refenv1, exp1, redex, exp2, printed1, exp3, refenv2, exp4, reduct, exp5, printed2
  // ]);

  // program shown to users
  const textForUser =
    first + refenv1 + exp1 + redex + exp2 + printed1 +
    exp3 + refenv2 + exp4 + reduct + exp5 + printed2;

  // save the current program
  currentProgram = text.substring(stepperCounter1, stepperProcessR1);
  // console.log(currentProgram);

  // save the next program to be executed
  nextProgram = text.substring(stepperCounter2, stepperProcessR2);
  // console.log(nextProgram);

  // wait for the document to create an editor
  await vscode.window.showTextDocument(stepperDocument);
  const editorForStepper = vscode.window.visibleTextEditors.find(editor =>
    editor.document === stepperDocument);

  // replace contents of stepperDocument; highlight redex, reduct, etc.
  if (editorForStepper) {
    await replaceContents(editorForStepper, textForUser);
    const index0L = first.length;
    const index0R = index0L + refenv1.length;
    const refEnv1Decorations = makeDecoration(stepperDocument, index0L, index0R);
    // editorForStepper.setDecorations(refEnvType, refEnv1Decorations);
    const index1L = index0R + exp1.length;
    const index1R = index1L + redex.length;
    const redexDecorations = makeDecoration(stepperDocument, index1L, index1R);
    editorForStepper.setDecorations(redexType, redexDecorations);
    const index2L = index1R + exp2.length;
    const index2R = index2L + printed1.length;
    const printed1Decorations = makeDecoration(stepperDocument, index2L, index2R);
    // editorForStepper.setDecorations(printedType, printed1Decorations);
    const index3L = index2R + exp3.length;
    const index3R = index3L + refenv2.length;
    const refEnv2Decorations =
      addDecoration(refEnv1Decorations, stepperDocument, index3L, index3R);
    editorForStepper.setDecorations(refEnvType, refEnv2Decorations);
    const index4L = index3R + exp4.length;
    const index4R = index4L + reduct.length;
    const reductDecorations = makeDecoration(stepperDocument, index4L, index4R);
    editorForStepper.setDecorations(reductType, reductDecorations);
    const index5L = index4R + exp5.length;
    const index5R = index5L + printed2.length;
    const printed2Decorations =
      addDecoration(printed1Decorations, stepperDocument, index5L, index5R);
    editorForStepper.setDecorations(printedType, printed2Decorations);
  } else {
    console.log('editor null');
  }

  // extract step numbers to see if the current step is skip
  let result = text.match(/\[@@@stepper.counter ([0-9]+)\]/g);
  if (!result) return; // can't happen
  const result2 = result.map((s) => s.match(/\[@@@stepper.counter ([0-9]+)\]/));
  const counter0 = Number(result2[0]![1]);
  const counter1 = Number(result2[1]![1]);
  currentlySkip = (counter1 - counter0 === 1 ? 0 : 1);
  // console.log(currentlySkip);
}

/*
function hideStepperProcess(
  document: vscode.TextDocument, startIndex: number): number {
  const text = document.getText();
  const index = text.indexOf("[@@@stepper.process", startIndex);
  const endIndex = findMatchingParenthesis(text, index);
  const decorationType = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(255, 0, 0, 0.3)',
    border: '1px solid red',
    // the following does not work...
    // textDecoration: 'none; display none;'
    // the following work but with space remaining
    // textDecoration: 'none',
    // color: 'transparent',
    // backgroundColor: 'transparent',
    // opacity: '0'
  });
  const decorations = [];
  const startPos = document.positionAt(index);
  const endPos = document.positionAt(endIndex + 1); // add 1 for ']'
  const decoration = { range: new vscode.Range(startPos, endPos) };
  decorations.push(decoration);
  const editor = vscode.window.visibleTextEditors.find(editor =>
    editor.document === document);
  if (editor) {
    editor.setDecorations(decorationType, decorations);
  } else {
    console.log('editor null');
  }

  return endIndex;
}
*/

/*
// find the index of matching closing parenthesis for the opening one at startIndex
function findMatchingParenthesis(text: string, startIndex: number): number {
  const stack: number[] = [];
  const openBrackets = ['(', '[', '{'];
  const closeBrackets = [')', ']', '}'];

  for (let i = startIndex; i < text.length; i++) {
    if (openBrackets.includes(text[i])) {
      stack.push(i);
    } else if (closeBrackets.includes(text[i])) {
      if (stack.length === 0) {
        return -1; // Unmatched closing bracket
      }
      const lastOpenIndex = stack.pop()!;
      if (openBrackets.indexOf(text[lastOpenIndex]) === closeBrackets.indexOf(text[i])) {
        if (stack.length === 0) {
          return i; // Found matching closing parenthesis
        }
      } else {
        return -1; // Mismatched brackets
      }
    }
  }

  return -1; // No matching closing parenthesis found
}
*/

// find all the matching parenthesis
function findAllMatchingParenthesis(text: string): number[][] | undefined {
  const stack: number[] = [];
  const result: number[][] = [];
  const openBrackets = ['(', '[', '{'];
  const closeBrackets = [')', ']', '}'];

  for (let i = 0; i < text.length; i++) {
    if (openBrackets.includes(text[i])) {
      stack.push(i);
    } else if (closeBrackets.includes(text[i])) {
      if (stack.length === 0) {
        return undefined; // Unmatched closing bracket
      }
      const lastOpenIndex = stack.pop()!;
      if (openBrackets.indexOf(text[lastOpenIndex]) === closeBrackets.indexOf(text[i])) {
        result.push([lastOpenIndex, i]); // Found matching closing parenthesis
      } else {
        return undefined; // Mismatched brackets
      }
    } else if (text[i] === '"') {
      i++; // skip the current "
      if (i === text.length) {
        return undefined; // Unclosed "
      }
      i = text.indexOf('"', i);// advance to closing "
      // indexOf returns the index from the beginnig of the text
      if (i < 0) {
        return undefined // Unclosed "
      }
    }
  }

  if (stack.length === 0) {
    return result;
  } else {
    return undefined; // Open bracket remaining
  }
}

// find the matching index in lst
function findMatchingIndex(lst: number[][], i: number): number | undefined {
  const p0 = lst.find(pair => pair[0] === i);
  if (p0) {
    return p0[1];
  }
  const p1 = lst.find(pair => pair[1] === i);
  if (p1) {
    return p1[0];
  }
  return undefined;
}

// called when "Ocha.stepper.next/skip/forward" is executed
// mode is either "next", "skip", or "nextitem" (for "forward")
function stepperNext(mode: string) {
  if (!stepperInstalled) {
    vscode.window.showInformationMessage("Stepper not installed.");
    return;
  }
  if (history.length === 0) {
    vscode.window.showInformationMessage("Stepper not started yet.");
    return;
  }

  // save the next program for step execution
  const fd = fs.openSync(tmpMlFileName, "w");
  let program = nextProgram; // (A)
  if (mode === "next" && afterPrev && currentlySkip) {
    program = currentProgram; // (B)
  } else if (mode === "skip") {
    if (currentlySkip) {
      mode = "next"; // (C)
    } else {
      program = currentProgram; // (D)
    }
  }
  /* when the current status is 3 -> 4:
       x stepper("next", 3) = 3 -> 4
   (A) o stepper("next", 4) = 4 -> 5
   (D) o stepper("skip", 3) = 3 -> 29 when skip is possible
   (D) o stepper("skip", 3) = 4 -> 5  when skip is not possible (!)
     when the current status is 3 -> 29 (not after prev):
   (A) o stepper("next", 29) = 29 -> 30
       x stepper("next", 3) = 3 -> 4
       - stepper("skip", 29) = 29 -> 39 (-) or 30 -> 31 (x)
   (C)-> stepper("next", 29) = 29 -> 30
       x stepper("skip", 3) = 3 -> 29
     when the current status is 3 -> 29 (after prev):
       x stepper("next", 29) = 29 -> 30
   (B) o stepper("next", 3) = 3 -> 4
       - stepper("skip", 29) = 29 -> 39 (-) or 30 -> 31 (x)
   (C)-> stepper("next", 29) = 29 -> 30
       x stepper("skip", 3) = 3 -> 29
  */
  fs.writeFileSync(fd, program);

  // execute stepper
  const text = executeStepper(mode, tmpMlFileName);
  fs.close(fd);
  afterPrev = 0;
  if (!text) return;

  // show a step
  showStep(text);
}

// called when "Ocha.stepper.prev" is executed
function stepperPrev() {
  if (!stepperInstalled) {
    vscode.window.showInformationMessage("Stepper not installed.");
    return;
  }
  if (history.length === 0) {
    vscode.window.showInformationMessage("Stepper not started yet.");
    return;
  } else if (history.length === 1) {
    vscode.window.showInformationMessage("No more steps.");
    return;
  }

  // remove the last step and obtain the previous step
  history.pop();
  const text = history[history.length - 1];
  afterPrev = 1;

  // show a step
  showStep(text);
}

// called when "Ocha.stepper.end" is executed
function stepperEnd() {
  if (!stepperInstalled) {
    vscode.window.showInformationMessage("Stepper not installed.");
    return;
  }
  if (history.length === 0) {
    vscode.window.showInformationMessage("Stepper not running.");
    return;
  }
  history = [];

  // close stepperDocument without saving it
  vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor',
    stepperDocument.uri);

  // want to nemove tmpMlFileName and tmpCmiFileName
}
