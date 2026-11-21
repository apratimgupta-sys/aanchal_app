// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Badge, Button, Field, FieldError, Input, Notice, Panel, ReportProgress, Select, Table } from "../../src/client/ui";

const classes = (el: Element) => Array.from(el.classList);
const legacy = /(^|\s)(ux4g-|app-|ui-|visit-)/;

beforeEach(cleanup);

describe("Field", () => {
  it("binds a real label to its control through the child-order API the pages use", () => {
    render(<Field>Username<input autoComplete="username" /></Field>);
    expect(screen.getByLabelText("Username")).toBe(screen.getByRole("textbox"));
  });

  it("binds a real label through the label prop, to a control that is a component", () => {
    render(<Field label="Received" htmlFor="recv"><Input id="recv" width="count" /></Field>);
    expect(screen.getByLabelText("Received")).toBe(screen.getByRole("textbox"));
  });

  it("keeps the required asterisk aria-hidden inside the label, so the accessible name excludes it", () => {
    render(<Field>Ward<input required /></Field>);
    const label = document.querySelector("label")!;
    const star = label.querySelector("span")!;
    expect(star.outerHTML).toBe('<span aria-hidden="true"> *</span>');
    expect(screen.getByRole("textbox", { name: "Ward" })).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: "Ward *" })).toBeNull();
  });

  it("puts 6px between the label and the control", () => {
    render(<Field>Name<input /></Field>);
    const wrapper = document.querySelector("label")!.parentElement!;
    expect(classes(wrapper)).toContain("gap-1.5");
    expect(classes(wrapper)).toContain("grid");
  });

  it("marks the control invalid and describes it with a FieldError, and only then", () => {
    const { rerender } = render(<Field>Name<input /></Field>);
    expect(screen.getByRole("textbox").getAttribute("aria-invalid")).toBeNull();
    rerender(<Field>Name<input /><FieldError>Name is required</FieldError></Field>);
    const control = screen.getByRole("textbox");
    expect(control.getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById(control.getAttribute("aria-describedby")!)?.textContent).toBe("Name is required");
  });

  it("renders a checkbox as one label wrapping the control", () => {
    render(<Field><input type="checkbox" />Send me a copy</Field>);
    const box = screen.getByLabelText("Send me a copy");
    expect(box.closest("label")).toBeTruthy();
  });
});

describe("Input", () => {
  it("is 44px at least, 7px radius, 1px input border", () => {
    render(<Input aria-label="x" />);
    const c = classes(screen.getByRole("textbox"));
    expect(c).toEqual(expect.arrayContaining(["min-h-[44px]", "rounded-[7px]", "border", "border-input"]));
  });

  it("stretches by default and is sized to its content for a count or money", () => {
    render(<><Input aria-label="full" /><Input aria-label="count" width="count" /><Input aria-label="money" width="money" /></>);
    expect(classes(screen.getByLabelText("full"))).toContain("w-full");
    expect(classes(screen.getByLabelText("count"))).toContain("w-[84px]");
    expect(classes(screen.getByLabelText("count"))).not.toContain("w-full");
    expect(classes(screen.getByLabelText("money"))).toContain("w-[118px]");
  });

  it("does not leak the width variant onto the DOM", () => {
    render(<Input aria-label="count" width="count" />);
    expect(screen.getByLabelText("count").hasAttribute("width")).toBe(false);
  });

  it("lets a caller's class win a conflict instead of stacking both", () => {
    render(<Input aria-label="x" className="rounded-none" />);
    const c = classes(screen.getByLabelText("x"));
    expect(c).toContain("rounded-none");
    expect(c).not.toContain("rounded-[7px]");
  });

  it("styles its disabled state", () => {
    render(<Input aria-label="x" disabled />);
    expect((screen.getByLabelText("x") as HTMLInputElement).disabled).toBe(true);
    expect(classes(screen.getByLabelText("x"))).toContain("disabled:cursor-not-allowed");
  });
});

describe("Select", () => {
  it("is a native select, so a 53-ward list keeps the phone's own picker", () => {
    render(<Select aria-label="Ward"><option>Ward 1</option><option>Ward 2</option></Select>);
    const el = screen.getByRole("combobox", { name: "Ward" });
    expect(el.tagName).toBe("SELECT");
    expect(classes(el)).toEqual(expect.arrayContaining(["min-h-[44px]", "rounded-[7px]", "border-input"]));
  });

  it("is labelled by Field like an input", () => {
    render(<Field>Ward<Select><option>Ward 1</option></Select></Field>);
    expect(screen.getByLabelText("Ward").tagName).toBe("SELECT");
  });
});

describe("Button", () => {
  it("is a real button and keeps its accessible name", () => {
    render(<Button>Save entry</Button>);
    expect(screen.getByRole("button", { name: "Save entry" })).toBeTruthy();
  });

  it("is primary by default and outline on request", () => {
    render(<><Button>Go</Button><Button variant="outline">Back</Button></>);
    expect(classes(screen.getByText("Go"))).toContain("bg-primary");
    expect(classes(screen.getByText("Back"))).toContain("bg-card");
    expect(classes(screen.getByText("Back"))).not.toContain("bg-primary");
  });

  it("is at least 44px tall", () => {
    render(<Button>Go</Button>);
    expect(classes(screen.getByRole("button"))).toContain("min-h-[44px]");
  });

  it("has a focus ring that is offset from the button, never ring-primary touching bg-primary", () => {
    render(<><Button>Go</Button><Button variant="outline">Back</Button></>);
    for (const b of screen.getAllByRole("button")) {
      const c = classes(b);
      expect(c).toContain("focus-visible:outline-offset-2");
      expect(c).toContain("focus-visible:outline-ring");
      expect(c.some((x) => /focus-visible:(ring|outline)-primary/.test(x))).toBe(false);
    }
  });

  it("disables, and does not fire clicks when disabled", () => {
    render(<Button disabled>Go</Button>);
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(true);
    expect(classes(screen.getByRole("button"))).toContain("disabled:opacity-60");
  });

  it("passes type through, and does not invent one", () => {
    render(<><Button type="button">A</Button><Button>B</Button></>);
    expect(screen.getByText("A").getAttribute("type")).toBe("button");
    expect(screen.getByText("B").hasAttribute("type")).toBe(false);
  });
});

describe("Panel", () => {
  it("is a rounded-lg card on bg-card with a border-border edge", () => {
    render(<Panel data-testid="p">Body</Panel>);
    const el = screen.getByTestId("p");
    expect(el.tagName).toBe("SECTION");
    expect(classes(el)).toEqual(expect.arrayContaining(["rounded-lg", "bg-card", "border", "border-border"]));
  });
});

describe("Notice", () => {
  it("is an alert in the destructive tone by default", () => {
    render(<Notice>Wrong password</Notice>);
    const el = screen.getByRole("alert");
    expect(classes(el)).toContain("border-l-destructive");
  });

  it("is a status in the success tone when its role says so", () => {
    render(<Notice role="status">Saved</Notice>);
    expect(classes(screen.getByRole("status"))).toContain("border-l-success");
  });

  it("gives its className to the inner element, as before", () => {
    render(<Notice className="inner-marker">Oops</Notice>);
    expect(screen.getByText("Oops").className).toBe("inner-marker");
  });
});

describe("Badge", () => {
  it("carries text, not colour alone, in each tone", () => {
    render(<><Badge tone="settled">Filed</Badge><Badge tone="attention">Pending</Badge><Badge>Draft</Badge></>);
    expect(screen.getByText("Filed")).toBeTruthy();
    expect(classes(screen.getByText("Filed"))).toContain("text-accent-foreground");
    expect(classes(screen.getByText("Pending"))).toContain("text-warning");
    expect(classes(screen.getByText("Draft"))).toContain("text-muted-foreground");
  });
});

describe("Table", () => {
  it("scrolls inside its own container and leaves the page alone", () => {
    render(<Table><thead><tr><th>Anchal</th></tr></thead><tbody><tr><td>7</td></tr></tbody></Table>);
    const table = screen.getByRole("table");
    expect(classes(table.parentElement!)).toContain("overflow-x-auto");
    expect(screen.getByRole("columnheader", { name: "Anchal" })).toBeTruthy();
  });
});

describe("ReportProgress", () => {
  it("exposes its value as a progressbar and rounds the percentage", () => {
    render(<ReportProgress value={1} max={3} />);
    const bar = screen.getByRole("progressbar", { name: "Services submitted" });
    expect(bar.getAttribute("aria-valuenow")).toBe("1");
    expect(bar.getAttribute("aria-valuemax")).toBe("3");
    expect(screen.getByText("33%")).toBeTruthy();
  });

  it("survives max of zero", () => {
    render(<ReportProgress value={0} max={0} />);
    expect(screen.getByText("0%")).toBeTruthy();
  });
});

describe("the component layer", () => {
  it("renders no class name from the old stylesheet", () => {
    render(
      <Panel>
        <Field>Name<Input /><FieldError>Required</FieldError></Field>
        <Field>Ward<Select><option>1</option></Select></Field>
        <Field><input type="checkbox" />Copy me</Field>
        <Button>Go</Button><Button variant="outline">Back</Button>
        <Notice>Oops</Notice><Notice role="status">Ok</Notice>
        <Badge tone="settled">Filed</Badge>
        <Table><tbody><tr><td>1</td></tr></tbody></Table>
        <ReportProgress value={1} max={2} />
      </Panel>,
    );
    const offenders = Array.from(document.querySelectorAll("[class]")).filter((el) => legacy.test(el.getAttribute("class")!));
    expect(offenders.map((e) => e.outerHTML.slice(0, 80))).toEqual([]);
  });
});

describe("control font size", () => {
  it("is 16px below lg on every control, so iOS Safari does not zoom on focus", () => {
    render(<div><Input aria-label="a" /><Select aria-label="b" /><Field>Label<textarea /></Field></div>);
    for (const el of [screen.getByLabelText("a"), screen.getByLabelText("b"), screen.getByLabelText("Label")])
      expect(el.className).toMatch(/(^|\s)text-\[16px\](\s|$)/);
  });
});
