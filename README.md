# ocha-platform

This is a Visual Studio Code extension for evaluating and step
executing OCaml programs.  It is used in the functional programming
course in Ochanomizu University.

## Features

### Evaluation
- Click <img src="media/resume.png" width="15px"> button to save the
  current file and evaluate it in a terminal.
- Click ▷ button to save the current
  file and execute `dune build` or `make` in a terminal.
- Click settings button to set the
  command for evaluating OCaml programs.  It defaults to `dune utop` if
  `dune` and `utop` are installed, `utop` if `utop` is installed,
  `rlwrap ocaml` if `rlwrap` is installed, `ocaml` otherwise.

### Step execution
- Click <img src="media/start.png" width="15px"> button to start step
  execution.
- Click <img src="media/prev.png" width="15px"> button to go back to the
  previous step.
- Click <img src="media/next.png" width="15px"> button to go to the next
  step.
- Click <img src="media/skip.png" width="15px"> button to evaluate the
  current expression completely (without showing the steps) and skip to
  the result.
- Click <img src="media/forward.png" width="15px"> button to go to the
  next toplevel definition (such as the next test case).
- Click <img src="media/end.png" width="15px"> button to end step
  execution.

## Requirements

For step execution, the
[OCaml Stepper](http://pllab.is.ocha.ac.jp/~asai/Stepper/)
is required.  The OCaml Stepper supports only OCaml version 4.14.2.
Install the OCaml Stepper via:
```
opam pin add stepper http://pllab.is.ocha.ac.jp/~asai/Stepper/4.14.2/stepper.tar.gz
```

<!-- ## Known Issues

Calling out known issues can help limit users opening duplicate issues against your extension. -->

<!-- ## Following extension guidelines

Ensure that you've read through the extensions guidelines and follow the best practices for creating your extension.

* [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)

## Working with Markdown

You can author your README using Visual Studio Code. Here are some useful editor keyboard shortcuts:

* Split the editor (`Cmd+\` on macOS or `Ctrl+\` on Windows and Linux).
* Toggle preview (`Shift+Cmd+V` on macOS or `Shift+Ctrl+V` on Windows and Linux).
* Press `Ctrl+Space` (Windows, Linux, macOS) to see a list of Markdown snippets.

## For more information

* [Visual Studio Code's Markdown Support](http://code.visualstudio.com/docs/languages/markdown)
* [Markdown Syntax Reference](https://help.github.com/articles/markdown-basics/)

**Enjoy!** -->
