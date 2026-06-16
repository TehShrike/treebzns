<script module lang="ts">
	import { state_type } from "#client/lib/state_type.ts";
	import AppScreen from "#client/component/AppScreen.svelte";

	export const asr_state = state_type({
		name: `design_system`,
		route: `/design_system`,
	});
</script>

<script lang="ts">
	import type { Attachment } from "svelte/attachments";

	// Highlights the clicked row within an interactive table, clearing any
	// previously highlighted row in the same body (single selection).
	const interactive_table_highlight: Attachment<HTMLElement> = (table) => {
		const on_click = (event: MouseEvent) => {
			const row = (event.target as HTMLElement | null)?.closest(`tr`);
			const body = row?.parentElement;

			if (!row || body?.tagName !== `TBODY`) {
				return;
			}

			for (const sibling of body.children) {
				sibling.classList.toggle(`highlighted`, sibling === row);
			}
		};

		table.addEventListener(`click`, on_click);

		return () => table.removeEventListener(`click`, on_click);
	};
</script>

<AppScreen>
	<main>
		<h2 id="components">Components</h2>

		<section class="component">
			<h3 id="button">Button</h3>
			<div>
				<blockquote>
					A <em>command button</em>, also referred to as a push button, is a control that causes the
					application to perform some action when the user clicks it.

					<footer>— Microsoft Windows User Experience p. 160</footer>
				</blockquote>

				<p>
					A standard button measures 75px wide and 23px tall, with a raised outer and inner border.
					They are given 12px of horizontal padding by default.
				</p>

				<div class="example">
					<button>Click me</button>
					<input type="submit" />
					<input type="reset" />
				</div>

				<p>
					You can add the class <code>default</code> to any button to apply additional styling,
					useful when communicating to the user what default action would happen in the active
					window if the <kbd>Enter</kbd> key was pressed on Windows 98.
				</p>

				<div class="example">
					<button class="default">OK</button>
				</div>

				<p>
					When buttons are clicked, the raised borders become sunken. The following button is
					simulated to be in the pressed (active) state.
				</p>

				<div class="example">
					<button class="active">I am being pressed</button>
				</div>

				<p>
					Disabled buttons maintain the same raised border, but have a "washed out" appearance in
					their label.
				</p>

				<div class="example">
					<button disabled>I cannot be clicked</button>
				</div>

				<p>
					Button focus is communicated with a dotted border, set 4px within the contents of the
					button. The following example is simulated to be focused.
				</p>

				<div class="example">
					<button class="focused">I am focused</button>
				</div>
			</div>
		</section>

		<section class="component">
			<h3 id="checkbox">Checkbox</h3>
			<div>
				<blockquote>
					A <em>check box</em> represents an independent or non-exclusive choice.
					<footer>— Microsoft Windows User Experience p. 167</footer>
				</blockquote>

				<p>
					Checkboxes are represented with a sunken panel, populated with a "check" icon when
					selected, next to a label indicating the choice.
				</p>

				<p>
					Note: You <strong>must</strong> include a corresponding label <strong>after</strong>
					your checkbox, using the <code>&lt;label&gt;</code> element with a <code>for</code>
					attribute pointed at the <code>id</code> of your input. This ensures the checkbox is easy to
					use with assistive technologies, on top of ensuring a good user experience for all (navigating
					with the tab key, being able to click the entire label to select the box).
				</p>

				<div class="example">
					<input type="checkbox" id="example1" />
					<label for="example1">This is a checkbox</label>
				</div>

				<p>
					Checkboxes can be selected and disabled with the standard <code>checked</code> and
					<code>disabled</code>
					attributes.
				</p>

				<p>
					When grouping inputs, wrap each input in a container with the <code>field-row</code> class.
					This ensures a consistent spacing between inputs.
				</p>

				<div class="example">
					<div class="field-row">
						<input checked type="checkbox" id="example2" />
						<label for="example2">I am checked</label>
					</div>
					<div class="field-row">
						<input disabled type="checkbox" id="example3" />
						<label for="example3">I am inactive</label>
					</div>
					<div class="field-row">
						<input checked disabled type="checkbox" id="example4" />
						<label for="example4">I am inactive but still checked</label>
					</div>
				</div>
			</div>
		</section>

		<section class="component">
			<h3 id="option-button">OptionButton</h3>
			<div>
				<blockquote>
					An <em>option button</em>, also referred to as a radio button, represents a single choice
					within a limited set of mutually exclusive choices. That is, the user can choose only one
					set of options.

					<footer>— Microsoft Windows User Experience p. 164</footer>
				</blockquote>

				<p>
					Option buttons can be used via the <code>radio</code> type on an input element.
				</p>

				<p>
					Option buttons can be grouped by specifying a shared <code>name</code> attribute on each
					input. Just as before: when grouping inputs, wrap each input in a container with the
					<code>field-row</code> class to ensure a consistent spacing between inputs.
				</p>

				<div class="example">
					<div class="field-row">
						<input id="radio5" type="radio" name="first-example" />
						<label for="radio5">Yes</label>
					</div>
					<div class="field-row">
						<input id="radio6" type="radio" name="first-example" />
						<label for="radio6">No</label>
					</div>
				</div>

				<p>
					Option buttons can also be <code>checked</code> and <code>disabled</code> with their corresponding
					HTML attributes.
				</p>

				<div class="example">
					<div class="field-row">
						<input id="radio7" type="radio" name="second-example" />
						<label for="radio7">Peanut butter should be smooth</label>
					</div>
					<div class="field-row">
						<input checked disabled id="radio8" type="radio" name="second-example" />
						<label for="radio8">I understand why people like crunchy peanut butter</label>
					</div>
					<div class="field-row">
						<input disabled id="radio9" type="radio" name="second-example" />
						<label for="radio9">Crunchy peanut butter is good</label>
					</div>
				</div>
			</div>
		</section>

		<section class="component">
			<h3 id="group-box">GroupBox</h3>
			<div>
				<blockquote>
					A <em>group box</em> is a special control you can use to organize a set of controls. A
					group box is a rectangular frame with an optional label that surrounds a set of controls.

					<footer>— Microsoft Windows User Experience p. 189</footer>
				</blockquote>

				<p>
					A group box can be used by wrapping your elements with the <code>fieldset</code> tag. It contains
					a sunken outer border and a raised inner border, resembling an engraved box around your controls.
				</p>

				<div class="example">
					<fieldset>
						<div class="field-row">Select one:</div>
						<div class="field-row">
							<input id="radio10" type="radio" name="fieldset-example" />
							<label for="radio10">Diners</label>
						</div>
						<div class="field-row">
							<input id="radio11" type="radio" name="fieldset-example" />
							<label for="radio11">Drive-Ins</label>
						</div>
						<div class="field-row">
							<input id="radio12" type="radio" name="fieldset-example" />
							<label for="radio12">Dives</label>
						</div>
					</fieldset>
				</div>

				<p>
					You can provide your group with a label by placing a <code>legend</code> element within
					the <code>fieldset</code>.
				</p>

				<div class="example">
					<fieldset>
						<legend>Today's mood</legend>
						<div class="field-row">
							<input id="radio13" type="radio" name="fieldset-example2" />
							<label for="radio13">Claire Saffitz</label>
						</div>
						<div class="field-row">
							<input id="radio14" type="radio" name="fieldset-example2" />
							<label for="radio14">Brad Leone</label>
						</div>
						<div class="field-row">
							<input id="radio15" type="radio" name="fieldset-example2" />
							<label for="radio15">Chris Morocco</label>
						</div>
						<div class="field-row">
							<input id="radio16" type="radio" name="fieldset-example2" />
							<label for="radio16">Carla Lalli Music</label>
						</div>
					</fieldset>
				</div>
			</div>
		</section>

		<section class="component">
			<h3 id="text-box">TextBox</h3>
			<div>
				<blockquote>
					A <em>text box</em> (also referred to as an edit control) is a rectangular control where
					the user enters or edits text. It can be defined to support a single line or multiple
					lines of text.

					<footer>— Microsoft Windows User Experience p. 181</footer>
				</blockquote>

				<p>
					Text boxes can rendered by specifying a <code>text</code> type on an
					<code>input</code> element. As with checkboxes and radio buttons, you should provide a
					corresponding label with a properly set <code>for</code>
					attribute, and wrap both in a container with the <code>field-row</code> class.
				</p>

				<div class="example">
					<div class="field-row">
						<label for="text17">Occupation</label>
						<input id="text17" type="text" />
					</div>
				</div>

				<p>
					Additionally, you can make use of the <code>field-row-stacked</code> class to position your
					label above the input instead of beside it.
				</p>

				<div class="example">
					<div class="field-row-stacked" style="width: 200px">
						<label for="text18">Address (Line 1)</label>
						<input id="text18" type="text" />
					</div>
					<div class="field-row-stacked" style="width: 200px">
						<label for="text19">Address (Line 2)</label>
						<input id="text19" type="text" />
					</div>
				</div>

				<p>
					To support multiple lines in the user's input, use the <code>textarea</code>
					element instead.
				</p>

				<div class="example">
					<div class="field-row-stacked" style="width: 200px">
						<label for="text20">Additional notes</label>
						<textarea id="text20" rows="8"></textarea>
					</div>
				</div>

				<p>
					Text boxes can also be disabled and have value with their corresponding HTML attributes.
				</p>

				<div class="example">
					<div class="field-row">
						<label for="text21">Favorite color</label>
						<input id="text21" disabled type="text" value="Windows Green" />
					</div>
				</div>
			</div>
		</section>

		<section class="component">
			<h3 id="slider">Slider</h3>
			<div>
				<blockquote>
					A <em>slider</em>, sometimes called a trackbar control, consists of a bar that defines the
					extent or range of the adjustment and an indicator that shows the current value for the
					control...

					<footer>— Microsoft Windows User Experience p. 146</footer>
				</blockquote>

				<p>
					Sliders can rendered by specifying a <code>range</code> type on an
					<code>input</code> element.
				</p>

				<div class="example">
					<div class="field-row" style="width: 300px">
						<label for="range22">Volume:</label>
						<label for="range23">Low</label>
						<input id="range23" type="range" min="1" max="11" value="5" />
						<label for="range24">High</label>
					</div>
				</div>

				<p>
					You can make use of the <code>has-box-indicator</code> class replace the default indicator
					with a box indicator, furthermore the slider can be wrapped with a <code>div</code> using
					<code>is-vertical</code> to display the input vertically.
				</p>

				<p>
					Note: To change the length of a vertical slider, the <code>input</code> width and
					<code>div</code> height.
				</p>

				<div class="example">
					<div class="field-row">
						<label for="range25">Cowbell</label>
						<div class="is-vertical">
							<input
								id="range25"
								class="has-box-indicator"
								type="range"
								min="1"
								max="3"
								step="1"
								value="2"
							/>
						</div>
					</div>
				</div>
			</div>
		</section>

		<section class="component">
			<h3 id="dropdown">Dropdown</h3>
			<div>
				<blockquote>
					A <em>drop-down list box</em> allows the selection of only a single item from a list. In
					its closed state, the control displays the current value for the control. The user opens
					the list to change the value.

					<footer>— Microsoft Windows User Experience p. 175</footer>
				</blockquote>

				<p>
					Dropdowns can be rendered by using the <code>select</code> and <code>option</code>
					elements.
				</p>

				<div class="example">
					<select>
						<option>5 - Incredible!</option>
						<option>4 - Great!</option>
						<option>3 - Pretty good</option>
						<option>2 - Not so great</option>
						<option>1 - Unfortunate</option>
					</select>
				</div>

				<p>
					By default, the first option will be selected. You can change this by giving one of your <code
						>option</code
					>
					elements the <code>selected</code>
					attribute.
				</p>

				<div class="example">
					<select>
						<option>5 - Incredible!</option>
						<option>4 - Great!</option>
						<option selected>3 - Pretty good</option>
						<option>2 - Not so great</option>
						<option>1 - Unfortunate</option>
					</select>
				</div>
			</div>
		</section>

		<h3 id="window">Window</h3>
		<p>The following components illustrate how to build complete windows using 98.css.</p>

		<section class="component">
			<h4 id="title-bar">Title Bar</h4>
			<div>
				<blockquote>
					At the top edge of the window, inside its border, is the title bar (also reffered to as
					the caption or caption bar), which extends across the width of the window. The title bar
					identifies the contents of the window.

					<footer>— Microsoft Windows User Experience p. 118</footer>
				</blockquote>

				<blockquote>
					Include command buttons associated with the common commands of the primary window in the
					title bar. These buttons act as shortcuts to specific window commands.

					<footer>— Microsoft Windows User Experience p. 122</footer>
				</blockquote>

				<p>
					You can build a complete title bar by making use of three classes,
					<code>title-bar</code>, <code>title-bar-text</code>, and <code>title-bar-controls</code>.
				</p>

				<div class="example">
					<div class="title-bar">
						<div class="title-bar-text">A Title Bar</div>
						<div class="title-bar-controls">
							<button aria-label="Close"></button>
						</div>
					</div>
				</div>

				<p>
					We make use of <code>aria-label</code> to render the Close button, to let assistive technologies
					know the intent of this button. You may also use "Minimize", "Maximize", "Restore" and "Help"
					like so:
				</p>

				<div class="example">
					<div class="title-bar">
						<div class="title-bar-text">A Title Bar</div>
						<div class="title-bar-controls">
							<button aria-label="Minimize"></button>
							<button aria-label="Maximize"></button>
							<button aria-label="Close"></button>
						</div>
					</div>

					<br />

					<div class="title-bar">
						<div class="title-bar-text">A Maximized Title Bar</div>
						<div class="title-bar-controls">
							<button aria-label="Minimize"></button>
							<button aria-label="Restore"></button>
							<button aria-label="Close"></button>
						</div>
					</div>

					<br />

					<div class="title-bar">
						<div class="title-bar-text">A Helpful Bar</div>
						<div class="title-bar-controls">
							<button aria-label="Help"></button>
							<button aria-label="Close"></button>
						</div>
					</div>
				</div>

				<p>
					Each <code>aria-label</code> also has a corresponding styling class to render the title
					bar buttons, to let the <code>aria-label</code> text be in other languages without causing rendering,
					accessibility, or localization issues.
				</p>

				<div class="example">
					<div class="title-bar">
						<div class="title-bar-text">A Title Bar using Button Styling Classes</div>
						<div class="title-bar-controls">
							<button aria-label="Any Text" class="minimize"></button>
							<button aria-label="Any Text" class="maximize"></button>
							<button aria-label="Any Text" class="close"></button>
						</div>
					</div>

					<br />

					<div class="title-bar">
						<div class="title-bar-text">A Maximized Title Bar using Button Styling Classes</div>
						<div class="title-bar-controls">
							<button aria-label="Any Text" class="minimize"></button>
							<button aria-label="Any Text" class="restore"></button>
							<button aria-label="Any Text" class="close"></button>
						</div>
					</div>

					<br />

					<div class="title-bar">
						<div class="title-bar-text">A Helpful Bar using Button Styling Classes</div>
						<div class="title-bar-controls">
							<button aria-label="Any Text" class="help"></button>
							<button aria-label="Any Text" class="close"></button>
						</div>
					</div>
				</div>

				<p>
					Maximize buttons can be disabled, useful when making a window appear as if it cannot be
					maximized.
				</p>

				<div class="example">
					<div class="title-bar">
						<div class="title-bar-text">A Title Bar with Maximize disabled</div>
						<div class="title-bar-controls">
							<button aria-label="Minimize"></button>
							<button aria-label="Maximize" disabled></button>
							<button aria-label="Close"></button>
						</div>
					</div>
				</div>

				<p>
					You can make a title bar "inactive" by adding <code>inactive</code> class, useful when making
					more than one window.
				</p>
				<div class="example">
					<div class="title-bar inactive">
						<div class="title-bar-text">An inactive title bar</div>
						<div class="title-bar-controls">
							<button aria-label="Close"></button>
						</div>
					</div>
				</div>
			</div>
		</section>

		<section class="component">
			<h4 id="window-contents">Window contents</h4>
			<div>
				<blockquote>
					Every window has a boundary that defines its shape.

					<footer>— Microsoft Windows User Experience p. 118</footer>
				</blockquote>

				<p>
					To give our title bar a home, we make use of the <code>window</code>
					class. This provides a raised outer and inner border, as well as some padding. We can freely
					resize the window by specifying a width in the container style.
				</p>

				<div class="example">
					<div class="window" style="width: 300px">
						<div class="title-bar">
							<div class="title-bar-text">A Complete Window</div>
							<div class="title-bar-controls">
								<button aria-label="Minimize"></button>
								<button aria-label="Maximize"></button>
								<button aria-label="Close"></button>
							</div>
						</div>
					</div>
				</div>

				<p>
					To draw the contents of the window, we use the <code>window-body</code>
					class under the title bar.
				</p>

				<div class="example">
					<div class="window" style="width: 300px">
						<div class="title-bar">
							<div class="title-bar-text">A Window With Stuff In It</div>
							<div class="title-bar-controls">
								<button aria-label="Minimize"></button>
								<button aria-label="Maximize"></button>
								<button aria-label="Close"></button>
							</div>
						</div>
						<div class="window-body">
							<p>There's so much room for activities!</p>
						</div>
					</div>
				</div>
			</div>
		</section>

		<section class="component">
			<h4 id="status-bar">Status Bar</h4>
			<div>
				<blockquote>
					A status bar is a special area within a window, typically the bottom, that displays
					information about the current state of what is being viewed in the window or any other
					contextual information, such as keyboard state.

					<footer>— Microsoft Windows User Experience p. 146</footer>
				</blockquote>

				<p>
					You can render a status bar with the <code>status-bar</code> class, and
					<code>status-bar-field</code> for every child text element.
				</p>

				<div class="example">
					<div class="window" style="width: 320px">
						<div class="title-bar">
							<div class="title-bar-text">A Window With A Status Bar</div>
						</div>
						<div class="window-body">
							<p>There are just so many possibilities:</p>
							<ul>
								<li>A Task Manager</li>
								<li>A Notepad</li>
								<li>Or even a File Explorer!</li>
							</ul>
						</div>
						<div class="status-bar">
							<p class="status-bar-field">Press F1 for help</p>
							<p class="status-bar-field">Slide 1</p>
							<p class="status-bar-field">CPU Usage: 14%</p>
						</div>
					</div>
				</div>
			</div>
		</section>

		<section class="component">
			<h3 id="tree-view">TreeView</h3>
			<div>
				<blockquote>
					A <em>tree view control</em> is a special list box control that displays a set of objects
					as an indented outline based on their logical hierarchical relationship.

					<footer>— Microsoft Windows User Experience p. 178</footer>
				</blockquote>

				<p>
					To render a tree view, use an <code>ul</code> element with the
					<code>tree-view</code> class. The children of this list (<code>li</code>
					elements), can contain whatever you'd like.
				</p>

				<div class="example">
					<ul class="tree-view">
						<li>We can put</li>
						<li><strong style="color: purple">✨ Whatever ✨</strong></li>
						<li>We want in here</li>
					</ul>
				</div>

				<p>
					To make this a tree, we can nest further <code>ul</code> elements (no class needed on these).
					This will provide them with a nice dotted border and indentation to illustrate the structure
					of the tree.
				</p>
				<p>
					To create expandable sections, wrap child lists inside of
					<code>details</code> elements.
				</p>

				<div class="example">
					<ul class="tree-view">
						<li>Table of Contents</li>
						<li>What is web development?</li>
						<li>
							CSS
							<ul>
								<li>Selectors</li>
								<li>Specificity</li>
								<li>Properties</li>
							</ul>
						</li>
						<li>
							<details open>
								<summary>JavaScript</summary>
								<ul>
									<li>Avoid at all costs</li>
									<li>
										<details>
											<summary>Unless</summary>
											<ul>
												<li>Avoid</li>
												<li>
													<details>
														<summary>At</summary>
														<ul>
															<li>Avoid</li>
															<li>At</li>
															<li>All</li>
															<li>Cost</li>
														</ul>
													</details>
												</li>
												<li>All</li>
												<li>Cost</li>
											</ul>
										</details>
									</li>
								</ul>
							</details>
						</li>
						<li>HTML</li>
						<li>Special Thanks</li>
					</ul>
				</div>
			</div>
		</section>

		<section class="component">
			<h3 id="tabs">Tabs</h3>
			<div>
				<blockquote>
					A <em>tab control</em> is analogous to a divider in a file cabinet or notebook. You can
					use this control to define multiple logical pages or sections of information within the
					same window.

					<footer>— Microsoft Windows User Experience p. 193</footer>
				</blockquote>

				<p>
					To render a tab list, use a <code>menu</code> element with the
					<code>[role=tablist]</code> attribute. The children of this menu (<code>li</code>
					elements), should get a <code>[role=tab]</code> attribute.
				</p>

				<p>
					Tabs should be managed by adding custom javascript code. All you need is to add the <code
						>[aria-selected=true]</code
					> attribute to the active tab.
				</p>

				<div class="example">
					<div class="window-body">
						<p>Hello, world!</p>

						<menu role="tablist">
							<li role="tab" aria-selected="true"><a href="#tabs">Desktop</a></li>
							<li role="tab"><a href="#tabs">My computer</a></li>
							<li role="tab"><a href="#tabs">Control panel</a></li>
							<li role="tab"><a href="#tabs">Devices manager</a></li>
							<li role="tab"><a href="#tabs">Hardware profiles</a></li>
							<li role="tab"><a href="#tabs">Performance</a></li>
						</menu>
						<div class="window" role="tabpanel">
							<div class="window-body">
								<p>the tab content</p>
							</div>
						</div>
					</div>
				</div>

				<p>
					To create multirows tabs, add a <code>multirows</code>
					class to the <code>menu</code> tag.
				</p>

				<div class="example">
					<div class="window-body">
						<p>Hello, world!</p>

						<menu role="tablist" class="multirows">
							<li role="tab"><a href="#tabs">Desktop</a></li>
							<li role="tab"><a href="#tabs">My computer</a></li>
							<li role="tab"><a href="#tabs">Control panel</a></li>
							<li role="tab"><a href="#tabs">Devices manager</a></li>
							<li role="tab"><a href="#tabs">Hardware profiles</a></li>
							<li role="tab"><a href="#tabs">Performance</a></li>
						</menu>
						<menu role="tablist" class="multirows">
							<li role="tab"><a href="#tabs">Users</a></li>
							<li role="tab"><a href="#tabs">Network</a></li>
							<li role="tab"><a href="#tabs">Programs</a></li>
							<li role="tab"><a href="#tabs">Services</a></li>
							<li role="tab"><a href="#tabs">Resources</a></li>
							<li role="tab"><a href="#tabs">Advanced</a></li>
						</menu>
						<div class="window" role="tabpanel">
							<div class="window-body">
								<p>the tab content</p>
							</div>
						</div>
					</div>
				</div>
			</div>
		</section>
		<section class="component">
			<h3 id="table-view">TableView</h3>
			<div>
				<p>
					To render a table view, use a table element. Wrap it with a div element with <code
						>sunken-panel</code
					> class to provide proper border and overflow container.
				</p>
				<p>
					With a bit of extra scripting you can make table view interactive. Give <code
						>interactive</code
					>
					class to table element to show pointer cursor when hovering over body rows. Table rows can
					be given
					<code>highlighted</code> class to appear selected.
				</p>

				<div class="example">
					<div class="sunken-panel" style="height: 120px; width: 240px;">
						<table class="interactive" {@attach interactive_table_highlight}>
							<thead>
								<tr>
									<th>Name</th>
									<th>Version</th>
									<th>Company</th>
								</tr>
							</thead>
							<tbody>
								<tr>
									<td>MySQL ODBC 3.51 Driver</td>
									<td>3.51.11.00</td>
									<td>MySQL AB</td>
								</tr>
								<tr>
									<td>SQL Server</td>
									<td>3.70.06.23</td>
									<td>Microsoft Corporation</td>
								</tr>
								<tr>
									<td>SQL Server</td>
									<td>3.70.06.23</td>
									<td>Microsoft Corporation</td>
								</tr>
								<tr>
									<td>SQL Server</td>
									<td>3.70.06.23</td>
									<td>Microsoft Corporation</td>
								</tr>
								<tr>
									<td>SQL Server</td>
									<td>3.70.06.23</td>
									<td>Microsoft Corporation</td>
								</tr>
								<tr>
									<td>SQL Server</td>
									<td>3.70.06.23</td>
									<td>Microsoft Corporation</td>
								</tr>
								<tr>
									<td>SQL Server</td>
									<td>3.70.06.23</td>
									<td>Microsoft Corporation</td>
								</tr>
								<tr>
									<td>SQL Server</td>
									<td>3.70.06.23</td>
									<td>Microsoft Corporation</td>
								</tr>
								<tr>
									<td>SQL Server</td>
									<td>3.70.06.23</td>
									<td>Microsoft Corporation</td>
								</tr>
								<tr>
									<td>SQL Server</td>
									<td>3.70.06.23</td>
									<td>Microsoft Corporation</td>
								</tr>
							</tbody>
						</table>
					</div>
				</div>
			</div>
		</section>

		<section class="component">
			<h3 id="progress-indicator">Progress Indicator</h3>
			<div>
				<blockquote>
					You can use a <em>progress indicator</em>, also known as a <em>progress bar control</em>,
					to show the percentage of completion of a lengthy operation.

					<footer>— Microsoft Windows User Experience p. 189</footer>
				</blockquote>

				<p>
					There are two types of progress bars: solid and segmented. The solid version is the
					default. To declare a segmented bar, you should use the <code>segmented</code> class.
				</p>

				<div class="example">
					<div class="progress-indicator">
						<span class="progress-indicator-bar" style="width: 40%;"> </span>
					</div>
				</div>

				<div class="example">
					<div class="progress-indicator segmented">
						<span class="progress-indicator-bar" style="width: 40%;"> </span>
					</div>
				</div>
			</div>
		</section>

		<section class="component">
			<h3 id="field-borders">Field borders</h3>
			<div>
				<blockquote>
					Text boxes, check boxes, drop-down list boxes, spin boxes and list boxes use the <em
						>field border style</em
					>. You can also use the style for define the work area within a window. It uses the sunken
					outer and sunken inner basic border styles. For most controls, the interior of the field
					uses the button highlight color. For text fields, such as text boxes and combo boxes, the
					interior uses the button face color when the field is read-only or disabled.

					<footer>— Microsoft Windows User Experience p. 421</footer>
				</blockquote>

				<blockquote>
					Status fields use the <em>status field border style</em>. This style uses only the sunken
					outer basic border style. You use the status field style in status bars and other
					read-only fields where the content of the file can change dynamically.

					<footer>— Microsoft Windows User Experience p. 422</footer>
				</blockquote>

				As mentioned in these guidelines, these styles are used in other contexts than just form
				elements and status fields such as to indicate work areas and dynamic content. For that
				reason, we provide three classes for these generic usages,<code>field-border</code>,
				<code>field-border-disabled</code>, and
				<code>status-field-border</code>. These classes only define the border and background color
				and minimal padding, so you will typically need to at least provide some extra padding
				yourself.

				<div class="example">
					<div class="field-border" style="padding: 8px">Work area</div>
				</div>

				<div class="example">
					<div class="field-border-disabled" style="padding: 8px">Disabled work area</div>
				</div>

				<div class="example">
					<div class="status-field-border" style="padding: 8px">Dynamic content</div>
				</div>
			</div>
		</section>
	</main>
</AppScreen>
