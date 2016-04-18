(function(){
	"use strict";
	
	KC3StrategyTabs.ships = new KC3StrategyTab("ships");
	
	KC3StrategyTabs.ships.definition = {
		tabSelf: KC3StrategyTabs.ships,
		
		shipCache:[],
		options: [],
		// default sorting method to Level
		currentSorters: [{name:"lv", reverse:false}],
		equipMode: 0,
		isLoading: false,
		multiKey: false,

		newFilterRep: {},
		// all sorters
		sorters: {},
		sorterDescCtrl: null,

		/* INIT
		Prepares all data needed
		---------------------------------*/
		init :function(){
			// Cache ship info
			PlayerManager.loadFleets();
			var ctr, ThisShip, ThisShipData;
			for(ctr in KC3ShipManager.list){
				ThisShip = KC3ShipManager.list[ctr];
				ThisShipData = this.prepareShipData(ThisShip);
				this.shipCache.push(ThisShipData);
			}

			this.prepareSorters();
		},

		getLastCurrentSorter: function() {
			return this.currentSorters[this.currentSorters.length-1];
		},

		reverseLastCurrentSorter: function() {
			var sorter = this.getLastCurrentSorter();
			sorter.reverse = ! sorter.reverse;
			this.updateSorterDescription();
		},

		// try pushing a new sorter to existing list
		// if the sorter already exists, the its "reverse"
		// value will be filpped.
		pushToCurrentSorters: function(name) {
			var i;
			var found = false;
			for (i=0; !found && i<this.currentSorters.length; ++i) {
				var sorterInfo = this.currentSorters[i];
				if (name === sorterInfo.name) {
					found = true;
					sorterInfo.reverse = ! sorterInfo.reverse;
				}
			}

			if (!found) {
				this.currentSorters.push({
					name: name,
					reverse: false
				});
			}

			this.updateSorterDescription();
		},

		setCurrentSorter: function(name) {
			var sorter = this.sorters[name];
			console.assert(sorter, "sorter should have been registered");
			this.currentSorters = [ {name: sorter.name, reverse:false} ];
			this.updateSorterDescription();
		},

		updateSorterDescription: function() {
			var self = this;
			var desc = this.currentSorters
				.map(function(sorterInfo) {
					var sorter = self.sorters[sorterInfo.name];
					return sorterInfo.reverse
						? sorter.desc + "(R)"
						: sorter.desc;
				})
				.join(" > ");

			this.sorterDescCtrl.text( desc );
		},

		// create comparator based on current list sorters
		makeComparator: function() {
			function reversed(comparator) {
				return function(a,b) {
					var result = comparator(a,b);
					return result === 0 
						? 0 
						: result < 0 ? 1 : -1;
				};
			}

			function compose(prevCmp,curCmp) {
				return function(a,b) {
					var prevResult = prevCmp(a,b);
					return prevResult !== 0 ? prevResult : curCmp(a,b);
				};
			}

			var self = this;
			return this.currentSorters
				.map( function(sorterInfo) {
					var sorter = self.sorters[sorterInfo.name];
					return sorterInfo.reverse
						? reversed(sorter.comparator) 
						: sorter.comparator;
				})
				.reduce( compose );
		},

		// prepares necessary info.
		// also stores those that doesn't need to be recomputed overtime.
		prepareShipData: function(ship) {
			var ThisShip = ship;
			var MasterShip = ThisShip.master();
			var cached =  {
				id: ThisShip.rosterId,
				bid : ThisShip.masterId,
				stype: MasterShip.api_stype,
				english: ThisShip.name(),
				level: ThisShip.level,
				morale: ThisShip.morale,
				equip: ThisShip.items,
				locked: ThisShip.lock,
				
				hp: ThisShip.hp[0],
				fp: [MasterShip.api_houg[1], MasterShip.api_houg[0]+ThisShip.mod[0], ThisShip.fp[0] ],
				tp: [MasterShip.api_raig[1], MasterShip.api_raig[0]+ThisShip.mod[1], ThisShip.tp[0] ],
				yasen: [
					MasterShip.api_houg[1] + MasterShip.api_raig[1],
					MasterShip.api_houg[0]+ThisShip.mod[0] + MasterShip.api_raig[0]+ThisShip.mod[1],
					ThisShip.fp[0] + ThisShip.tp[0]
				],
				aa: [MasterShip.api_tyku[1], MasterShip.api_tyku[0]+ThisShip.mod[2], ThisShip.aa[0] ],
				ar: [MasterShip.api_souk[1], MasterShip.api_souk[0]+ThisShip.mod[3], ThisShip.ar[0] ],
				as: [this.getDerivedStatNaked("tais", ThisShip.as[0], ThisShip.items), ThisShip.as[0] ],
				ev: [this.getDerivedStatNaked("houk", ThisShip.ev[0], ThisShip.items), ThisShip.ev[0] ],
				ls: [this.getDerivedStatNaked("saku", ThisShip.ls[0], ThisShip.items), ThisShip.ls[0] ],
				lk: ThisShip.lk[0],
				sp: MasterShip.api_soku,
				slots: ThisShip.slots,
				fleet: ThisShip.onFleet(),
				ship: ThisShip,
				master: ThisShip.master(),
				// Check whether remodel is max
				remodel: RemodelDb.isFinalForm(ship.masterId)
			};
			var ThisShipData = cached;
			// Check whether modernization is max
			if( ThisShipData.fp[0] == ThisShipData.fp[1]
				&& ThisShipData.tp[0] == ThisShipData.tp[1]
				&& ThisShipData.aa[0] == ThisShipData.aa[1]
				&& ThisShipData.ar[0] == ThisShipData.ar[1]
			  )
				ThisShipData.statmax = 1;
			else
				ThisShipData.statmax = 0;

			return cached;
		},
		
		/* EXECUTE
		Places data onto the interface
		---------------------------------*/
		execute :function(){
			// now we need to do this before preparing filters
			// Ship types
			var sCtr, cElm;

			for(sCtr in KC3Meta._stype){
				if(KC3Meta._stype[sCtr]){
					cElm = $(".tab_ships .factory .ship_filter_type").clone()
						.appendTo(".tab_ships .filters .ship_types");
					cElm.data("id", sCtr);
					$(".filter_name", cElm).text(KC3Meta.stype(sCtr));
				}
			}

			this.sorterDescCtrl = $(".advanced_sorter .sorter_desc");
			this.updateSorterDescription();

			var self = this;
			var multiKeyCtrl = $( ".advanced_sorter .adv_sorter" );
			$(".filter_check",multiKeyCtrl).toggle( this.multiKey );
			this.sorterDescCtrl.toggle(this.multiKey);
			multiKeyCtrl.on("click", function() {
				self.multiKey = ! self.multiKey;
				$(".filter_check",this).toggle( self.multiKey );
				self.sorterDescCtrl.toggle(self.multiKey);
			});

			this.prepareFilters();
			this.shipList = $(".tab_ships .ship_list");
			this.showFilters();
		},

		// default UI actions for options that are mutually exclusive
		// NOTE: this function is supposed to be a shared callback function
		// and should not be called directly.
		_mutualExclusiveOnToggle: function(selectedInd,optionRep) {
			// mutural exclusive options use just value indices
			// as the option value
			var oldVal = optionRep.curValue;
			if (oldVal === selectedInd)
				return;
			// first update value
			optionRep.curValue = selectedInd;
			// then update UI accordingly
			$.each(optionRep.options, function(thisInd, optionObj) {
				optionObj.view.toggleClass('on', thisInd === selectedInd);
			});
			// only trigger update when it's not the first time
			// first time we just need to give it a initial value (default value)
			// and then upate UI.
			if (oldVal !== null)
				this.refreshTable();
		},

		// findView given filter's name and this option
		// NOTE: this function is supposed to be a shared callback function
		// and should not be called directly.
		_commonFindView: function(filterName, option) {
			return $(".tab_ships .filters .massSelect"
					 +" ." + filterName
					 + "_" + option);
		},

		/* 
		   defineShipFilter defines a filter that has UI controls.
		   
		   see comments on each arguments for detail.
		 */
		defineShipFilter: function(
			// a string name for this filter
			filterName,
			// ship filters can hold a piece of value
			// which represents its state.
			// (e.g. true / false for keeping track of whether
			//  this filter is enabled or disable)
			defValue,
			// an array of arbitrary values, each of the option should
			// correspond to a toggle / control on UI
			options,
			// a callback function testShip(curVal,ship)
			// that does the actual fitlering:
			// returning a falsy value means
			// the ship should be filtered out from the list.
			// curVal is the current state of the filter.
			testShip,
			// findView(filterName,option) should return
			// a jQuery object that represents the UI control specified by
			// "filterName" and "option", where "option" is one value from "options"
			// note that the length of the jquery object has to be exactly one,
			// otherwise you'll see assertion failures in the console.
			findView,
			// onToggle(newVal,optionRep) that triggers either when initializing
			// or when user has changed something on UI.
			// optionRep is the runtime representation of this filter:
			// * optionRep.curValue represents the current value
			//   held by this filter, when initializing, this value is set to "null".
			// * optionRep.options is the runtime representation of
			//   all options you have passed to this function.
			//   for all valid options indices ind
			//   * optionRep.options[ind].name is set to options[ind]
			//   * optionRep.options[ind].view is set to the jQuery object returned
			//     by your "findView".
			// your onToggle is responsible for 2 things:
			// * when initalizing a filter, "optionRep.curValue" is set to "null",
			//   in this case "newVal" is "defValue" you passed to this function,
			//   you should do something like "optionRep.curValue = newVal"
			//   to complete initializing filter state. and update UI accordingly
			//   (but avoid refreshing ship list, since we are just initalizing)
			// * when user does something on UI, your onToggle function will be triggered.
			//   in this case "newVal" is set to an index of "options" to indicate
			//   which option triggers this function. in this case you are responsible
			//   for updating "optionRep.curValue" accordingly, updating UI to reflect the change
			//   and finally refresh ship list to execute all filters.
			onToggle) {
			var self = this;
			// as most filters are groups of mutually exclusive controls
			// it makes sense setting them as defaults
			if (! findView)
				findView = this._commonFindView;
			if (! onToggle)
				onToggle = this._mutualExclusiveOnToggle;

			var newOptions = [];
			$.each(options, function(ind, optionName) {
				var thisOption = {};
				var view = findView(filterName,optionName);
				thisOption.name = optionName;
				thisOption.view = view;
				thisOption.view.on('click', function() {
					var curRep = self.newFilterRep[filterName];
					var selectedInd = ind;
					curRep.onToggle.call(self,selectedInd,curRep);
				});
				console.assert(
					thisOption.view.length === 1,
					"expecting exactly one result of getView on " 
						+ filterName  + "," + optionName );
				newOptions.push( thisOption );
			});

			var optionRep = {
				curValue: null,
				options: newOptions,
				onToggle: onToggle,
				testShip: function (ship) {
					return testShip(optionRep.curValue,ship);
				}
			};
					
			this.newFilterRep[filterName] = optionRep;
			optionRep.onToggle.call(self,defValue,optionRep);
		},

		prepareFilters: function() {
			var self = this;
			self.defineShipFilter(
				"marriage",
				0,
				[ "in","on","ex" ],
				function(curVal, ship) {
					return (curVal === 0)
						|| (curVal === 1 && ship.level >= 100)
						|| (curVal === 2 && ship.level <  100);
				});

			self.defineShipFilter(
				"remodel",
				0,
				["all","max","nomax"],
				function(curVal, ship) {
					return (curVal === 0)
						|| (curVal === 1 && ship.remodel)
						|| (curVal === 2 && !ship.remodel);
				});

			self.defineShipFilter(
				"modernization",
				0,
				["all","max","nomax"],
				function(curVal, ship) {
					return (curVal === 0)
						|| (curVal === 1 && ship.statmax)
						|| (curVal === 2 && !ship.statmax);
				});
				
			self.defineShipFilter(
				"heartlock",
				 0,
				["all","yes","no"],
				function(curVal, ship) {
					return (curVal === 0)
						|| (curVal === 1 && ship.locked === 1)
						|| (curVal === 2 && ship.locked === 0);
				});

			self.defineShipFilter(
				"speed",
				0,
				["all","fast","slow"],
				function(curVal,ship) {
					return (curVal === 0)
						|| (curVal === 1 && ship.sp >= 10)
						|| (curVal === 2 && ship.sp < 10);
				});

			self.defineShipFilter(
				"fleet",
				1,
				["no","yes"],
				function(curVal,ship) {
					return (curVal === 0 && !ship.fleet)
						|| (curVal === 1);
				});

			var stypes = Object
				.keys(KC3Meta._stype)
				.map(function(x) { return parseInt(x,10); })
				.sort(function(a,b) { return a-b; });
			console.assert(stypes[0] === 0);
			// remove initial "0", which is invalid
			stypes.shift();
			var stypeDefValue = [];
			$.each(stypes, function(ignore, stype) {
				stypeDefValue[stype] = true;
			});

			self.defineShipFilter(
				"stype",
				stypeDefValue,
				// valid ship types and addtionally 3 controls
				stypes.concat(["all","none","invert"]),
				// testShip
				function(curVal,ship) {
					return curVal[ship.stype];
				},
				// find view
				function (filterName,option) {
					if (typeof option === "number") {
						// this is a ship type toggle
						return $(".tab_ships .filters .ship_types .ship_filter_type")
							.filter( function() {  return $(this).data("id") === "" + option;  }  );
					} else {
						// one of: all / none / invert
						return $(".tab_ships .filters .massSelect ." + option);
					}
				},
				// onToggle
				function(selectedInd, optionRep) {
				var initializing = false;
				if (optionRep.curValue === null) {
					// the variable name is a bit misleading,
					// but when "optionRep.curValue" is null
					// we know we are initializing
					initializing = true;
					optionRep.curValue = selectedInd;
				} else {
					var selected = optionRep.options[selectedInd];
					if (typeof selected.name === 'number') {
						// this is a ship type toggle
						optionRep.curValue[selected.name] = !optionRep.curValue[selected.name];
					} else {
						$.each(stypes, function(ignore, stype) {
							optionRep.curValue[stype] = 
								  (selected.name === "all")
								? true
								: (selected.name === "none")
								? false
							    : ! optionRep.curValue[stype];
						});
					}
				}
				// update UI
				$.each(optionRep.options, function(ignored, x) {
					if (typeof x.name === "number") {
					  $( ".filter_check", x.view ).toggle( optionRep.curValue[x.name]  );
					}
				});

				if (!initializing)
					self.refreshTable();
			}
			);
		},

		// execute all registered filters on a ship
		executeFilters: function(ship) {
			var filterKeys = Object.keys(this.newFilterRep);
			var i;
			for (i=0;i<filterKeys.length;++i) {
				var key = filterKeys[i];
				var filter = this.newFilterRep[key].testShip;
				if (!filter(ship))
					return false;
			}
			return true;
		},
		
		/* FILTERS
		Ship types, and other toggles
		---------------------------------*/
		showFilters :function(){
			var self = this;
			var sCtr;
			
			// Equip Stats: Yes
			self.options.equip_yes = $(".tab_ships .filters .massSelect .equip_yes").on("click", function(){
				self.equipMode = 1;
				self.refreshTable();
				self.options.equip_yes.addClass('on');
				self.options.equip_no.removeClass('on');
			});
			
			// Equip Stats: No
			self.options.equip_no = $(".tab_ships .filters .massSelect .equip_no").on("click", function(){
				self.equipMode = 0;
				self.refreshTable();
				self.options.equip_yes.removeClass('on');
				self.options.equip_no.addClass('on');
			});
			
			// Default status
			if( self.equipMode )
				self.options.equip_yes.addClass('on');
			else
				self.options.equip_no.addClass('on');

			// Column header sorting
			$(".tab_ships .ship_header .ship_field.hover").on("click", function(){
				var sorter = self.getLastCurrentSorter();
				var sorterName = $(this).data("type");
				if (sorterName === sorter.name) {
					self.reverseLastCurrentSorter();
				} else {
					if (self.multiKey) {
						// for multi index sorters
						self.pushToCurrentSorters( sorterName );
					} else {
						// for normal sorters
						self.setCurrentSorter( sorterName  );
					}
				}
				self.refreshTable();
			});
			
			this.refreshTable();
		},


		defineSorter: function(name,desc,comparator) {
			this.sorters[name] = {
				name: name,
				desc: desc,
				comparator: comparator
			};
		},

		defineSimpleSorter: function(name,desc,getter) {
			var self = this;
			this.defineSorter(
				name,desc,
				function(a,b) {
					var va = getter.call(self,a);
					var vb = getter.call(self,b);
					return va === vb
						 ? 0 
						 : (va < vb) ? -1 : 1;
				});
		},

		prepareSorters: function() {
			var define = this.defineSimpleSorter.bind(this);

			define("id", "Id",
				   function(x) { return x.id; });
			define("name", "Name", 
				   function(x) { return x.english; });
			define("type", "Type",
				   function(x) { return x.stype; });
			define("lv", "Level",
				   function(x) { return -x.level; });
			define("morale", "Morale",
				   function(x) { return -x.morale; });
			define("hp", "HP",
				   function(x) { return -x.hp; });
			define("fp", "Firepower",
				   function(x) { return -x.fp[this.equipMode+1]; });
			define("tp", "Torpedo",
				   function(x) { return -x.tp[this.equipMode+1]; });
			define("yasen", "Yasen",
				   function(x) { return -(x.fp[this.equipMode+1] + x.tp[this.equipMode+1]); });
			define("aa", "Anti-Air",
				   function(x) { return -x.aa[this.equipMode+1]; });
			define("ar", "Armor",
				   function(x) { return -x.ar[this.equipMode+1]; });
			define("as", "ASW",
				   function(x) { return -x.as[this.equipMode]; });
			define("ev", "Evasion",
				   function(x) { return -x.ev[this.equipMode]; });
			define("ls", "LoS",
				   function(x) { return -x.ls[this.equipMode]; });
			define("lk", "Luck",
				   function(x) { return -x.lk; });
		},
		
		/* REFRESH TABLE
		Reload ship list based on filters
		---------------------------------*/
		refreshTable :function(){
			if(this.isLoading){ return false; }
			this.isLoading = true;
			
			var self = this;
			this.startTime = Date.now();
			
			// Clear list
			this.shipList.html("").hide();

			// Wait until execute
			setTimeout(function(){
				var shipCtr, cElm, cShip, shipLevel;

				// Filtering
				var FilteredShips = self.shipCache.filter(function(x) {
					return self.executeFilters(x);
				});

				// Sorting
				FilteredShips.sort( self.makeComparator() );

				// Fill up list
				Object.keys(FilteredShips).forEach(function(shipCtr){
					if(shipCtr%10 === 0){
						$("<div>").addClass("ingame_page").html("Page "+Math.ceil((Number(shipCtr)+1)/10)).appendTo(self.shipList);
					}
					
					cShip = FilteredShips[shipCtr];
					shipLevel = cShip.level;

					// we can save some time by avoiding constructing jquery object
					// if we already have one
					if (cShip.view) {
						cElm = cShip.view;
						cElm.appendTo(self.shipList);

						if (cElm.onRecompute)
							cElm.onRecompute();
						return;
					}

					cElm = $(".tab_ships .factory .ship_item").clone().appendTo(self.shipList);
					cShip.view = cElm;
					if(shipCtr%2 === 0){ cElm.addClass("even"); }else{ cElm.addClass("odd"); }
					
					$(".ship_id", cElm).text( cShip.id );
					$(".ship_img .ship_icon", cElm).attr("src", KC3Meta.shipIcon(cShip.bid));
					$(".ship_name", cElm).text( cShip.english );
					if(shipLevel >= 100) {
						$(".ship_name", cElm).addClass("ship_kekkon-color");
					}
					$(".ship_type", cElm).text( KC3Meta.stype(cShip.stype) );
					var shipLevelConv = shipLevel;
					$(".ship_lv", cElm).html( "<span>Lv.</span>" + shipLevelConv);
					$(".ship_morale", cElm).html( cShip.morale );
					$(".ship_hp", cElm).text( cShip.hp );
					$(".ship_lk", cElm).text( cShip.lk );
					
					if(cShip.morale >= 50){ $(".ship_morale", cElm).addClass("sparkled"); }

					// callback for things that has to be recomputed
					cShip.onRecompute = function() {
						self.modernizableStat("fp", cElm, cShip.fp);
						self.modernizableStat("tp", cElm, cShip.tp);
						self.modernizableStat("yasen", cElm, cShip.yasen);
						self.modernizableStat("aa", cElm, cShip.aa);
						self.modernizableStat("ar", cElm, cShip.ar);
					
						$(".ship_as", cElm).text( cShip.as[self.equipMode] );
						$(".ship_ev", cElm).text( cShip.ev[self.equipMode] );
						$(".ship_ls", cElm).text( cShip.ls[self.equipMode] );
					};

					cShip.onRecompute();
					
					[1,2,3,4].forEach(function(x){
						self.equipImg(cElm, x, cShip.slots[x-1], cShip.equip[x-1]);
					});
					
					if(FilteredShips[shipCtr].locked){ $(".ship_lock img", cElm).show(); }

					// Check whether remodel is max
						if( !cShip.remodel )
							cElm.addClass('remodel-max');
						else
							cElm.addClass('remodel-able');

					// Check whether modernization is max
						if( cShip.statmax )
							cElm.addClass('modernization-max');
						else
							cElm.addClass('modernization-able');
				});
				
				self.shipList.show();
				self.isLoading = false;
				console.log("Showing this list took", (Date.now() - self.startTime)-100 , "milliseconds");
			},100);
		},
		
		/* Compute Derived Stats without Equipment
		--------------------------------------------*/
		getDerivedStatNaked :function(StatName, EquippedValue, Items){
			for(var ctr in Items){
				if(Items[ctr] > -1){
					EquippedValue -= KC3GearManager.get( Items[ctr] ).master()["api_"+StatName];
				}
			}
			return EquippedValue;
		},
		
		/* Show cell contents of a mod stat
		--------------------------------------------*/
		modernizableStat :function(stat, cElm, Values){
			$(".ship_"+stat, cElm).text( Values[this.equipMode+1] );
			if(Values[0] == Values[1]){
				$(".ship_"+stat, cElm).addClass("max");
			}else{
				$(".ship_"+stat, cElm).append("<span>+"+(Values[0] - Values[1])+"</span>");
			}
		},
		
		/* Show single equipment icon
		--------------------------------------------*/
		equipImg :function(cElm, equipNum, equipSlot, gear_id){
			var element = $(".ship_equip_" + equipNum, cElm);
			if(gear_id > -1){
				var gear = KC3GearManager.get(gear_id);
				if(gear.itemId<=0){ element.hide(); return; }

				var masterGear = KC3Master.slotitem(gear.api_slotitem_id);
				$("img",element)
					.attr("src", "../../assets/img/items/" + gear.master().api_type[3] + ".png")
					.attr("title", gear.name());
				$("span",element).css('visibility','hidden');
			} else {
				$("img",element).hide();
				$("span",element).each(function(i,x){
					if(equipSlot > 0)
						$(x).text(equipSlot);
					else
						$(x).css('visibility','hidden');
				});
			}
		}
	};
	
})();
