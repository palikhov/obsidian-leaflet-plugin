import {
	Plugin,
	MarkdownPostProcessorContext,
	addIcon,
	Notice,
	MarkdownView,
	Modal,
	Setting,
	Workspace,
	TFile,
} from "obsidian";
import { point, latLng } from "leaflet";

//Local Imports
import './main.css';

import { ObsidianLeafletSettingTab, DEFAULT_SETTINGS } from "./settings";
import {
	IconDefinition,
	AbstractElement,
	icon,
	toHtml,
	getIcon,
} from "./icons";
import LeafletMap from "./leaflet";
declare global {
	/* interface MapsInterface {
		[sourcePath: string]: MapInterface;
	} */
	interface Marker {
		type: string;
		iconName: string;
		color?: string;
		layer?: boolean;
		transform?: { size: number; x: number; y: number };
	}
	interface LeafletMarker {
		marker: MarkerIcon;
		loc: L.LatLng;
		id: string;
		link?: string;
		leafletInstance: L.Marker;
	}

	interface MarkerData {
		type: string;
		loc: [number, number];
		id: string;
		link: string;
	}
	interface MapMarkerData {
		path: string;
		markers: MarkerData[];
	}
	interface ObsidianAppData {
		mapMarkers: MapMarkerData[];
		markerIcons: Marker[];
		defaultMarker: Marker;
		color: string;
	}
	type MarkerIcon = {
		readonly type: string;
		readonly html: string;
	};
}
interface MarkdownPostProcessorContextActual
	extends MarkdownPostProcessorContext {
	sourcePath: string;
	containerEl: HTMLElement;
}

export default class ObsidianLeaflet extends Plugin {
	AppData: ObsidianAppData;
	markerIcons: MarkerIcon[];
	maps: LeafletMap[] = [];
	async onload(): Promise<void> {
		console.log("loading leaflet plugin");

		await this.loadSettings();

		this.markerIcons = this.generateMarkerMarkup(this.AppData.markerIcons);

		this.registerMarkdownCodeBlockProcessor(
			"leaflet",
			this.postprocessor.bind(this)
		);

		this.registerEvent(
			this.app.vault.on("delete", async file => {
				if (
					this.AppData.mapMarkers.find(marker =>
						marker.path.includes(file.path)
					)
				) {
					this.AppData.mapMarkers = this.AppData.mapMarkers.filter(
						marker =>
							marker !=
							this.AppData.mapMarkers.find(marker =>
								marker.path.includes(file.path)
							)
					);

					await this.saveSettings();
				}
			})
		);

		this.addSettingTab(new ObsidianLeafletSettingTab(this.app, this));
	}

	async onunload(): Promise<void> {
		console.log("unloading plugin");
	}

	async postprocessor(
		source: string,
		el: HTMLElement,
		ctx: MarkdownPostProcessorContextActual
	): Promise<void> {
		let { image, height = "500px" } = Object.fromEntries(
			source.split("\n").map(l => l.split(": "))
		);

		if (!image) {
			console.error("An image source url must be provided.");
			new Notice("An image source url must be provided.");
			el.appendText("An image source url must be provided.");
			el.setAttribute("style", "color: red;");
			return;
		}

		let map = new LeafletMap(
			el,
			image,
			height,
			ctx.sourcePath,
			this.markerIcons
		);

		if (
			this.AppData.mapMarkers.find(
				map => map.path == `${ctx.sourcePath}/${image}`
			)
		) {
			await map.loadData(
				this.AppData.mapMarkers.find(
					map => map.path == `${ctx.sourcePath}/${image}`
				).markers
			);
		}

		if (this.maps.find(map => map.path == `${ctx.sourcePath}/${image}`)) {
			this.maps = this.maps.filter(
				map => map.path != `${ctx.sourcePath}/${image}`
			);
		}
		this.maps.push(map);

		this.registerDomEvent(el, "dragover", evt => {
			evt.preventDefault();
		});
		this.registerDomEvent(el, "drop", evt => {
			evt.stopPropagation();

			let file = decodeURIComponent(
				evt.dataTransfer.getData("text/plain")
			)
				.split("file=")
				.pop();

			map.createMarker(
				map.markerIcons[0],
				map.map.layerPointToLatLng(point(evt.offsetX, evt.offsetY)),
				file + ".md"
			);
		});

		this.registerEvent(
			map.on("marker-added", async (marker: LeafletMarker) => {
				await this.saveSettings();
			})
		);

		this.registerEvent(
			map.on("marker-click", (link: string, newWindow: boolean) => {
				this.app.workspace
					.openLinkText("", link, newWindow)
					.then(() => {
						var cmEditor = this.getEditor();
						cmEditor.focus();
					});
			})
		);

		this.registerEvent(
			map.on("marker-context", async (marker: LeafletMarker) => {
				let markerSettingsModal = new Modal(this.app);

				new Setting(markerSettingsModal.contentEl)
					.setName("Note to Open")
					.setDesc(
						"Path of note to open, e.g. Folder1/Folder2/Note.md"
					)
					.addText(text => {
						text.setPlaceholder("Path")
							.setValue(marker.link)
							.onChange(async value => {
								marker.link = value;
								await this.saveSettings();
							});
					});

				new Setting(markerSettingsModal.contentEl)
					.setName("Marker Type")
					.addDropdown(drop => {
						drop.addOption("default", "Base Marker");
						this.AppData.markerIcons.forEach(marker => {
							drop.addOption(marker.type, marker.type);
						});
						drop.setValue(marker.marker.type).onChange(
							async value => {
								let newMarker =
									value == "default"
										? this.AppData.defaultMarker
										: this.AppData.markerIcons.find(
												m => m.type == value
										  );
								let html: string,
									iconNode: AbstractElement = icon(
										getIcon(newMarker.iconName),
										{
											transform: { size: 6, x: 0, y: -2 },
											mask: getIcon(
												this.AppData.defaultMarker
													?.iconName
											),
											classes: ["full-width-height"],
										}
									).abstract[0];

								iconNode.attributes = {
									...iconNode.attributes,
									style: `color: ${
										newMarker.color
											? newMarker.color
											: this.AppData.defaultMarker?.color
									}`,
								};

								html = toHtml(iconNode);

								marker.marker = {
									type: newMarker.type,
									html: html,
								};

								await this.saveSettings();
							}
						);
					});

				new Setting(markerSettingsModal.contentEl).addButton(b => {
					b.setIcon("trash")
						.setWarning()
						.setTooltip("Delete Marker")
						.onClick(async () => {
							marker.leafletInstance.remove();
							map.markers = map.markers.filter(
								m => m.id != marker.id
							);
							markerSettingsModal.close();
							await this.saveSettings();
						});
					return b;
				});

				markerSettingsModal.open();
			})
		);

		await this.saveSettings();
	}

	async loadSettings() {
		this.AppData = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}
	async saveSettings() {
		//build map marker data

		let markers = this.maps.map(
			(map): MapMarkerData => {
				return {
					path: map.path,
					markers: map.markers.map(
						(marker): MarkerData => {
							return {
								type: marker.marker.type,
								id: marker.id,
								loc: [marker.loc.lat, marker.loc.lng],
								link: marker.link,
							};
						}
					),
				};
			}
		);
		this.AppData.mapMarkers = markers;
		await this.saveData(this.AppData);

		this.AppData.markerIcons.forEach(marker => {
			addIcon(marker.type, icon(getIcon(marker.iconName)).html[0]);
		});

		this.markerIcons = this.generateMarkerMarkup(this.AppData.markerIcons);

		this.maps.forEach(map => map.setMarkerIcons(this.markerIcons));
	}
	getEditor() {
		let view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (view) {
			return view.sourceMode.cmEditor;
		}
		return null;
	}

	generateMarkerMarkup(
		markers: Marker[] = this.AppData.markerIcons
	): MarkerIcon[] {
		let ret = markers.map(marker => {
			if (!marker.transform) {
				marker.transform = this.AppData.defaultMarker.transform;
			}
			if (!marker.iconName) {
				marker.iconName = this.AppData.defaultMarker.iconName;
			}
			let html: string,
				iconNode: AbstractElement = icon(getIcon(marker.iconName), {
					transform: marker.transform,
					mask: getIcon(this.AppData.defaultMarker?.iconName),
					classes: ["full-width-height"],
				}).abstract[0];

			iconNode.attributes = {
				...iconNode.attributes,
				style: `color: ${
					marker.color
						? marker.color
						: this.AppData.defaultMarker?.color
				}`,
			};

			html = toHtml(iconNode);

			return { type: marker.type, html: html };
		});
		if (this.AppData.defaultMarker.iconName) {

			ret.unshift({
				type: "default",
				html: icon(getIcon(this.AppData.defaultMarker.iconName), {
					classes: ["full-width-height"],
					styles: {
						color: this.AppData.defaultMarker.color,
					},
				}).html[0],
			});
		}

		return ret;
	}
}