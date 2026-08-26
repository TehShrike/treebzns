<script module lang="ts">
	import { state_type } from "#client/lib/client_type.ts";
	import AppScreen from "#client/component/AppScreen.svelte";
	import FormLayout from "#client/component/FormLayout.svelte";

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
			<blockquote>
				A <em>command button</em>, also referred to as a push button, is a control that causes the
				application to perform some action when the user clicks it.

				<footer>— Microsoft Windows User Experience p. 160</footer>
			</blockquote>

			<p>
				A standard button is at least 75px wide and 23px tall, with a raised outer and inner border.
				They are given 16px of horizontal and 6px of vertical padding by default.
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
		</section>

		<section class="component">
			<h3 id="checkbox">Checkbox</h3>
			<blockquote>
				A <em>check box</em> represents an independent or non-exclusive choice.
				<footer>— Microsoft Windows User Experience p. 167</footer>
			</blockquote>

			<p>
				Checkboxes are represented with a sunken panel, populated with a "check" icon when
				selected, next to a label indicating the choice.
			</p>

			<p>
				Note: You <strong>must</strong> wrap your checkbox in a corresponding
				<code>&lt;label&gt;</code> element. This ensures the checkbox is easy to use with
				assistive technologies, on top of ensuring a good user experience for all (navigating
				with the tab key, being able to click the entire label to select the box).
			</p>

			<div class="example">
				<label><input type="checkbox" />This is a checkbox</label>
			</div>

			<p>
				Checkboxes can be selected and disabled with the standard <code>checked</code> and
				<code>disabled</code>
				attributes.
			</p>

			<p>
				When grouping inputs, wrap the group in a container with the <code>field-row-stacked</code>
				class. This ensures a consistent spacing between inputs.
			</p>

			<div class="example">
				<div class="field-row-stacked">
					<label><input checked type="checkbox" />I am checked</label>
					<label><input disabled type="checkbox" />I am inactive</label>
					<label><input checked disabled type="checkbox" />I am inactive but still checked</label>
				</div>
			</div>
		</section>

		<section class="component">
			<h3 id="option-button">OptionButton</h3>
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
				input. Just as before: when grouping inputs, wrap the group in a container with the
				<code>field-row-stacked</code> class to ensure a consistent spacing between inputs.
			</p>

			<div class="example">
				<div class="field-row-stacked">
					<label><input type="radio" name="first-example" />Yes</label>
					<label><input type="radio" name="first-example" />No</label>
				</div>
			</div>

			<p>
				Option buttons can also be <code>checked</code> and <code>disabled</code> with their corresponding
				HTML attributes.
			</p>

			<div class="example">
				<div class="field-row-stacked">
					<label><input type="radio" name="second-example" />Peanut butter should be smooth</label>
					<label><input checked disabled type="radio" name="second-example" />I understand why people like crunchy peanut butter</label>
					<label><input disabled type="radio" name="second-example" />Crunchy peanut butter is good</label>
				</div>
			</div>
		</section>

		<section class="component">
			<h3 id="group-box">GroupBox</h3>
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
					<div>Select one:</div>
					<label><input type="radio" name="fieldset-example" />Diners</label>
					<label><input type="radio" name="fieldset-example" />Drive-Ins</label>
					<label><input type="radio" name="fieldset-example" />Dives</label>
				</fieldset>
			</div>

			<p>
				You can provide your group with a label by placing a <code>legend</code> element within
				the <code>fieldset</code>.
			</p>

			<div class="example">
				<fieldset>
					<legend>Today's mood</legend>
					<label><input type="radio" name="fieldset-example2" />Claire Saffitz</label>
					<label><input type="radio" name="fieldset-example2" />Brad Leone</label>
					<label><input type="radio" name="fieldset-example2" />Chris Morocco</label>
					<label><input type="radio" name="fieldset-example2" />Carla Lalli Music</label>
				</fieldset>
			</div>
		</section>

		<section class="component">
			<h3 id="text-box">TextBox</h3>
			<blockquote>
				A <em>text box</em> (also referred to as an edit control) is a rectangular control where
				the user enters or edits text. It can be defined to support a single line or multiple
				lines of text.

				<footer>— Microsoft Windows User Experience p. 181</footer>
			</blockquote>

			<p>
				Text boxes can be rendered by specifying a <code>text</code> type on an
				<code>input</code> element. As with checkboxes and radio buttons, wrap the input in a
				<code>label</code> element. The label text sits above the input by default.
			</p>

			<div class="example">
				<label style="width: 200px">
					Occupation
					<input type="text" />
				</label>
			</div>

			<p>
				Add the <code>field-row</code> class to the label to place the text beside the input
				instead.
			</p>

			<div class="example">
				<label class="field-row">
					Occupation
					<input type="text" />
				</label>
			</div>

			<p>
				When grouping several fields, wrap the labels in a container with the
				<code>field-row-stacked</code> class to ensure a consistent spacing between them.
			</p>

			<div class="example">
				<div class="field-row-stacked" style="width: 200px">
					<label>
						Address (Line 1)
						<input type="text" />
					</label>
					<label>
						Address (Line 2)
						<input type="text" />
					</label>
				</div>
			</div>

			<p>
				To support multiple lines in the user's input, use the <code>textarea</code>
				element instead.
			</p>

			<div class="example">
				<label style="width: 200px">
					Additional notes
					<textarea rows="8"></textarea>
				</label>
			</div>

			<p>
				Text boxes can also be disabled and have value with their corresponding HTML attributes.
			</p>

			<div class="example">
				<label style="width: 200px">
					Favorite color
					<input disabled type="text" value="Windows Green" />
				</label>
			</div>
		</section>

		<section class="component">
			<h3 id="dropdown">Dropdown</h3>
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
		</section>

		<h3 id="window">Window</h3>
		<p>The following components illustrate how to build complete windows using 98.css.</p>

		<section class="component">
			<h4 id="title-bar">Title Bar</h4>
			<blockquote>
				At the top edge of the window, inside its border, is the title bar (also reffered to as
				the caption or caption bar), which extends across the width of the window. The title bar
				identifies the contents of the window.

				<footer>— Microsoft Windows User Experience p. 118</footer>
			</blockquote>

			<p>
				You can build a title bar by making use of two classes, <code>title-bar</code> and
				<code>title-bar-text</code>.
			</p>

			<div class="example">
				<div class="title-bar">
					<div class="title-bar-text">A Title Bar</div>
				</div>
			</div>

			<p>
				You can make a title bar "inactive" by adding the <code>inactive</code> class, useful
				when making more than one window.
			</p>

			<div class="example">
				<div class="title-bar inactive">
					<div class="title-bar-text">An inactive title bar</div>
				</div>
			</div>
		</section>

		<section class="component">
			<h4 id="status-bar">Status Bar</h4>
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
		</section>

		<section class="component">
			<h3 id="tree-view">TreeView</h3>
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
		</section>

		<section class="component">
			<h3 id="tabs">Tabs</h3>
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
						<li role="tab" aria-selected="true"><a href="#/design_system">Desktop</a></li>
						<li role="tab"><a href="#/design_system">My computer</a></li>
						<li role="tab"><a href="#/design_system">Control panel</a></li>
						<li role="tab"><a href="#/design_system">Devices manager</a></li>
						<li role="tab"><a href="#/design_system">Hardware profiles</a></li>
						<li role="tab"><a href="#/design_system">Performance</a></li>
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
						<li role="tab"><a href="#/design_system">Desktop</a></li>
						<li role="tab"><a href="#/design_system">My computer</a></li>
						<li role="tab"><a href="#/design_system">Control panel</a></li>
						<li role="tab"><a href="#/design_system">Devices manager</a></li>
						<li role="tab"><a href="#/design_system">Hardware profiles</a></li>
						<li role="tab"><a href="#/design_system">Performance</a></li>
					</menu>
					<menu role="tablist" class="multirows">
						<li role="tab"><a href="#/design_system">Users</a></li>
						<li role="tab"><a href="#/design_system">Network</a></li>
						<li role="tab"><a href="#/design_system">Programs</a></li>
						<li role="tab"><a href="#/design_system">Services</a></li>
						<li role="tab"><a href="#/design_system">Resources</a></li>
						<li role="tab"><a href="#/design_system">Advanced</a></li>
					</menu>
					<div class="window" role="tabpanel">
						<div class="window-body">
							<p>the tab content</p>
						</div>
					</div>
				</div>
			</div>
		</section>
		<section class="component">
			<h3 id="table-view">TableView</h3>
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
				<div class="sunken-panel" style="height: 120px; width: 600px;">
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

				<p>
					Without sunken-table:
				</p>

				<div class="example">
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
		</section>

		<section class="component">
			<h3 id="progress-indicator">Progress Indicator</h3>
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
		</section>

		<section class="component">
			<h3 id="field-borders">Field borders</h3>
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
		</section>

		<section class="component">
			<h3 id="form-layout">FormLayout</h3>
			<p>
				<code>FormLayout</code> arranges a set of fields so they sit side by side when there is room
				and wrap to the next line when there isn't. Each field is held between a minimum and maximum
				width, so a field never gets too narrow to use or so wide it looks lonely. It uses flexbox
				rather than a grid, which lets each row pack in as many fields as will fit.
			</p>

			<p>
				Pass your fields as children — each one should be a <code>&lt;label&gt;</code> wrapping its
				input, so the label text stacks above the input, and the layout stretches the input to fill
				the field. The field widths are controlled by the <code>min_field_width</code> and
				<code>max_field_width</code> props, which default to <code>12rem</code> and
				<code>20rem</code>.
			</p>

			<p>
				Set <code>outlined</code> to wrap the form in the engraved outline, and pass a
				<code>name</code> to print a label at the top of it. An optional <code>buttons</code> snippet
				is always pinned to the bottom right.
			</p>

			<p>
				The following example shows off everything at once: a named outline, five customer fields
				that flow side by side, and a buttons snippet in the bottom corner. Resize the window to
				watch the fields reflow.
			</p>

			<div class="example">
				<FormLayout outlined legend="Customer details">
					<label>
						Name
						<input type="text" value="Acme Landscaping" />
					</label>
					<label>
						Email
						<input type="email" value="hello@acme.example" />
					</label>
					<label>
						Phone
						<input type="tel" value="(555) 010-1234" />
					</label>
					<label>
						Referred by
						<input type="text" value="Word of mouth" />
					</label>
					<label>
						Tax rate
						<select>
							<option>No tax</option>
							<option selected>State sales tax (6%)</option>
							<option>Reduced rate (2%)</option>
						</select>
					</label>

					{#snippet buttons()}
						<button type="button">Cancel</button>
						<button type="submit" class="default">Save customer</button>
					{/snippet}
				</FormLayout>
			</div>

			<p>
				Without the outline (the default), there is no border or legend — just the fields and the
				optional buttons. This is handy when the form already lives inside another container.
			</p>

			<div class="example">
				<FormLayout>
					<label>
						Name
						<input type="text" value="Bridgetown Nursery" />
					</label>
					<label>
						Email
						<input type="email" value="orders@bridgetown.example" />
					</label>
					<label>
						Phone
						<input type="tel" value="(555) 867-5309" />
					</label>
				</FormLayout>
			</div>

			<p>
				The field width bounds can be tuned per form. Here the fields are given a much wider range,
				so fewer fit on each row and each one grows larger before wrapping.
			</p>

			<div class="example">
				<FormLayout outlined legend="Wide fields" min_field_width="18rem" max_field_width="32rem">
					<label>
						Mailing address
						<input type="text" value="123 Garden Way" />
					</label>
					<label>
						Notes
						<textarea rows="2">Prefers afternoon appointments.</textarea>
					</label>
				</FormLayout>
			</div>
		</section>
	</main>
</AppScreen>

<style>
	main {
		max-width: 800px;
	}

	.component, main {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	main {
		gap: 16px;
	}
</style>
