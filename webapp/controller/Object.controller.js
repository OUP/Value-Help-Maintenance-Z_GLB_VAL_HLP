sap.ui.define(
  [
    "./BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/odata/v2/ODataModel",
    "sap/ui/model/FilterOperator",
    "sap/ui/core/routing/History",
    "sap/ui/core/ListItem",
    "sap/ui/comp/smartfield/SmartField",
    "sap/ui/layout/form/SimpleForm",
    "sap/ui/table/Table",
    "sap/ui/table/Column",
    "sap/m/Toolbar",
    "sap/m/ToolbarSpacer",
    "sap/m/Title",
    "sap/m/Dialog",
    "sap/m/Label",
    "sap/m/Button",
    "sap/m/ButtonType",
    "sap/m/Text",
    "sap/m/Input",
    "sap/m/Select",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "../model/formatter",
    "./ErrorHandler",
    "sap/m/ComboBox",
    "sap/ui/core/Item",
  ],
  function (
    BaseController,
    JSONModel,
    ODataModel,
    FilterOperator,
    History,
    ListItem,
    SmartField,
    SimpleForm,
    Table,
    Column,
    Toolbar,
    ToolbarSpacer,
    Title,
    Dialog,
    Label,
    Button,
    ButtonType,
    Text,
    Input,
    Select,
    MessageBox,
    MessageToast,
    formatter,
    ErrorHandler,
    ComboBox,
    Item
  ) {
    "use strict";

    let _oDynamicModel = null;
    let _oDynamicDialog = null;
    let _oDynamicDialogNewItemContext = null;
    let _aDynamicFields = [];
    let _oDynamicTable = null;
    let _oDynamicTableContainer = null;
    let _oViewModel = null;
    let _oView = null;
    let _bCreate = false;
    let _oErrorHandler = null;
    let _aHeaderDetails = [];
    const _sGroupId = `${new Date().getTime()}`;

    return BaseController.extend("oup.glb.zglbvaluehelp.controller.Object", {
      formatter: formatter,

      /* =========================================================== */
      /* lifecycle methods                                           */
      /* =========================================================== */

      /**
       * Called when the worklist controller is instantiated.
       * @public
       */
      onInit: function () {
        // Model used to manipulate control states. The chosen values make sure,
        // detail page is busy indication immediately so there is no break in
        // between the busy indication for loading the view's meta data
        var iOriginalBusyDelay;

        _oView = this.getView();

        _oViewModel = new JSONModel({
          busy: true,
          delay: 0,
          pageTitle: "",
          pageTitleCDS: "",
          isPageEditable: false,
          isMinRowSelected: false,
        });

        this.setModel(_oViewModel, "objectView");

        // initialise
        _oDynamicTableContainer = _oView.byId(
          "dynamicValueHelpTableContainerId"
        );

        this.getRouter()
          .getRoute("object")
          .attachPatternMatched(this._onObjectMatched, this);

        // Store original busy indicator delay, so it can be restored later on
        iOriginalBusyDelay = _oView.getBusyIndicatorDelay();

        // Restore original busy indicator delay for the object view
        setTimeout(
          () => _oViewModel.setProperty("/delay", iOriginalBusyDelay),
          1000
        );

        //Country Collection
        var oCountryJModel = new JSONModel();
        oCountryJModel.loadData(
          "/sap/opu/odata/sap/ZPTP_SB_UI_COUNTRYVH_O2/I_CountryVH"
        );
        this.getView().setModel(oCountryJModel, "Country");

        //Condition type Collection
        var oConditionJModel = new JSONModel();
        oConditionJModel.loadData(
          "/sap/opu/odata/sap/ZPTP_SB_UI_CONDTYPE_O2/ZPTP_I_CONDTYPEVH"
        );
        this.getView().setModel(oConditionJModel, "CondType");
      },

      /* =========================================================== */
      /* event handlers                                              */
      /* =========================================================== */

      /**
       * Event handler  for navigating back.
       * It there is a history entry we go one step back in the browser history
       * If not, it will replace the current entry of the browser history with the worklist route.
       * @public
       */
      onClosePress: function () {
        var sPreviousHash = History.getInstance().getPreviousHash();

        if (sPreviousHash !== undefined) {
          history.go(-1);
        } else {
          this.getRouter().navTo("worklist", {}, true);
        }
      },

      onCancelPress: function (oEvent) {
        // clear the table changes
        if (_oDynamicModel.hasPendingChanges()) {
          const bCompact = !!_oView.$().closest(".sapUiSizeCompact").length;

          // check any row is selected before
          MessageBox.confirm("Are you sure, you want to discard the changes?", {
            actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
            emphasizedAction: MessageBox.Action.OK,
            styleClass: bCompact ? "sapUiSizeCompact" : "",
            onClose: (sAction) => {
              if (sAction !== MessageBox.Action.OK) {
                return;
              }

              // reset changes
              _oDynamicModel.resetChanges();
            },
          });
        }
      },

      onSavePress: function () {
        const bCompact = !!_oView.$().closest(".sapUiSizeCompact").length;

        // set busy
        _oDynamicTable.setBusy(true);

        if (_oDynamicModel.hasPendingChanges()) {
          _oDynamicModel.submitChanges({
            success: function (oData) {
              _oDynamicTable.setBusy(false);

              let sMessage = "";
              let bErrorFlag = false;

              try {
                const oBatchResponse = oData.__batchResponses[0];
                if (oBatchResponse.response.statusCode === "400") {
                  let oResponseBody = JSON.parse(oBatchResponse.response.body);

                  sMessage = oResponseBody.error.message.value;
                  bErrorFlag = true;
                }
              } catch (error) {
                /* no action required since there are no errors found */
              }

              if (bErrorFlag) {
                MessageBox.error("Error", {
                  details: sMessage,
                  styleClass: bCompact ? "sapUiSizeCompact" : "",
                });
              } else {
                MessageBox.success(
                  _bCreate
                    ? "Created successfully"
                    : "Changes saved successfully",
                  {
                    styleClass: bCompact ? "sapUiSizeCompact" : "",
                  }
                );

                // clear table selections
                _oDynamicTable.clearSelection();

                // clear page edit
                _oViewModel.setProperty("/isPageEditable", false);
              }
            }.bind(this),
            error: function (_oError) {
              _oDynamicTable.setBusy(false);
              MessageBox.error(
                _bCreate ? "Error in creation" : "Error in saving the changes",
                {
                  styleClass: bCompact ? "sapUiSizeCompact" : "",
                }
              );
            },
          });
        } else {
          MessageBox.information("No changes found to save", {
            styleClass: bCompact ? "sapUiSizeCompact" : "",
          });
          _oDynamicTable.setBusy(false);
        }
      },

      onCancelPress: () => _oViewModel.setProperty("/isPageEditable", false),

      onEditPress: () => _oViewModel.setProperty("/isPageEditable", true),

      /* =========================================================== */
      /* internal methods                                            */
      /* =========================================================== */

      /**
       * Binds the view to the object path.
       * @function
       * @param {sap.ui.base.Event} oEvent pattern match event in route 'object'
       * @private
       */
      _onObjectMatched: function (oEvent) {
        // set busy indicator
        _oViewModel.setProperty("/busy", true);

        // get cds name
        var sCDS = oEvent.getParameter("arguments").cds;

        // get valueHelpList details
        _aHeaderDetails = this._loadHeaderDetails(sCDS);

        if (_aHeaderDetails.length === 0) {
          // cds is not maintained in value help list
        } else {
          // set the value in view model
          _oViewModel.setProperty("/pageTitle", `${_aHeaderDetails[0].title}`);
          _oViewModel.setProperty("/entity", `${_aHeaderDetails[0].entity}`);
          _oViewModel.setProperty(
            "/pageTitleCDS",
            `CDS: ${_aHeaderDetails[0].cds}`
          );

          this._loadDynamicModel(sCDS);
        }
      },

      _loadHeaderDetails: function (sCDS) {
        const _oHeaderList = this.getModel("valueHelpList").getData();
        // filter by cds view name
        return _oHeaderList.filter((obj) => obj.cds === sCDS);
      },

      _checkFrieghtData: (sValue) => {
        const aData = ["COUNTRY", "RATE", "CONDTYPE"];
        const aResult = aData.filter((obj) => obj === sValue) || [];
        return aResult.length > 0;
      },

      /**
       * Load metadata and create dynamic table and place it in the container.
       * @function
       * @param {string} sServiceURL path to the object to be bound
       * @private
       */
      _loadDynamicModel: function (sServiceURL) {
        _oDynamicModel = new ODataModel(
          `/sap/opu/odata/sap/${sServiceURL}/`,
          true
        );

        // destroy dynamic container items
        _oDynamicTableContainer.destroyItems();
        _oDynamicDialogNewItemContext = null;
        _aDynamicFields = [];
        _oDynamicTable = null;
        _bCreate = false;

        // clear page edit
        _oViewModel.setProperty("/isPageEditable", false);

        // remove existing error handler
        if (_oErrorHandler) _oErrorHandler.destroy();
        _oErrorHandler = null;

        // remove existing dialog
        if (_oDynamicDialog) _oDynamicDialog.destroy();
        _oDynamicDialog = null;

        // initialize the error handler with the component
        _oErrorHandler = new ErrorHandler(
          this.getOwnerComponent(),
          _oDynamicModel
        );

        _oDynamicModel.metadataLoaded().then(() => {
          try {
            // set deferred group for batch operations
            _oDynamicModel.setDeferredGroups(
              _oDynamicModel.getDeferredGroups().concat([_sGroupId])
            );

            _oDynamicTable = new Table({
              visibleRowCount: 10,
              rowSelectionChange: (_) =>
                _oViewModel.setProperty(
                  "/isMinRowSelected",
                  _oDynamicTable.getSelectedIndices().length > 0
                ),
            });

            // table column definitions
            const oMeta = _oDynamicModel.getServiceMetadata();
            const sEntity = _oViewModel.getProperty("/entity"); // sServiceURL.split("_CDS")[0];

            for (const oEntityType of oMeta.dataServices.schema[0].entityType) {
              // check the valid entity
              if (oEntityType.name !== `${sEntity}Type`) {
                continue;
              }

              for (const [index, oProperty] of oEntityType.property.entries()) {
                // skip the below fields
                if (
                  oProperty.name === "SAP_UUID" ||
                  oProperty.name === "SAP_CreatedByUser_Text" ||
                  oProperty.name === "SAP_LastChangedByUser_Text" ||
                  oProperty.name === "ZREFMDPRODDES" // Series Code and its descriptions
                ) {
                  // check for series code description map to sap description
                  if (oProperty.name === "ZREFMDPRODDES") {
                    _aDynamicFields.push({
                      label: "Description",
                      name: "SAP_Description",
                    });
                  }

                  continue;
                }

                const aExtensionFilter = oProperty.extensions.filter(
                  (obj) => obj.name === "label"
                );
                let sLable = oProperty.name;

                if (aExtensionFilter.length !== 0) {
                  sLable = aExtensionFilter[0].value || "";
                }

                // add dynamic fields for form creation and save actions
                if (index === 1 || index === 2) {
                  _aDynamicFields.push({
                    label: sLable,
                    name: oProperty.name,
                  });
                }

                // add CONDTYPE for freight rate BO
                if (sEntity === "FREIGHTRATES" && index === 3) {
                  _aDynamicFields.push({
                    label: sLable,
                    name: oProperty.name,
                  });
                }

                // default control
                let oControl = new SmartField({
                  value: `{path: '${oProperty.name}'}`,
                  editable: false,
                });

                // change control for freight rate
                if (this._checkFrieghtData(oProperty.name)) {
                  if (oProperty.name === "COUNTRY") {
                    let oTemplateLItem = new ListItem({
                      key: "{Country>Country}",
                      text: "{Country>Country}",
                      additionalText: "{Country>Description}",
                    });
                    oControl = new ComboBox({
                      value: `{path: '${oProperty.name}',  mode: 'TwoWay'}`,
                      selectedKey: `{path: '${oProperty.name}',  mode: 'TwoWay'}`,
                      editable: `{objectView>/isPageEditable}`,
                      width: "100%",
                      showSecondaryValues: true,
                      items: {
                        path: "Country>/d/results",
                        templateShareable: false,
                        template: oTemplateLItem,
                      },
                    });
                  } else if (oProperty.name === "CONDTYPE") {
                    let oTemplateLItem = new ListItem({
                      key: "{CondType>vtext}",
                      text: "{CondType>kschl}",
                      additionalText: "{CondType>vtext}",
                    });
                    oControl = new ComboBox({
                      value: `{path: '${oProperty.name}',  mode: 'TwoWay'}`,
                      selectedKey: `{path: '${oProperty.name}',  mode: 'TwoWay'}`,
                      editable: `{objectView>/isPageEditable}`,
                      width: "100%",
                      showSecondaryValues: true,
                      items: {
                        path: "CondType>/d/results",
                        templateShareable: false,
                        template: oTemplateLItem,
                      },
                    });
                  } else {
                    oControl = new SmartField({
                      value: `{path: '${oProperty.name}',  mode: 'TwoWay'}`,
                      editable: `{objectView>/isPageEditable}`,
                    });
                  }
                }

                // description bulk edit mode
                if (oProperty.name === "SAP_Description") {
                  oControl = new SmartField({
                    value: `{path: '${oProperty.name}',  mode: 'TwoWay'}`,
                    editable: "{objectView>/isPageEditable}",
                  });
                }

                const oColumn = new Column({
                  label: new Label({ text: sLable }),
                  template: oControl,
                  sortProperty: oProperty.name,
                  filterProperty: oProperty.name,
                  filterOperator: FilterOperator.EQ,
                  flexible: true,
                  width:
                    oProperty.name === "SAP_Description" ? "300px" : "auto",
                });

                // add column to table
                _oDynamicTable.addColumn(oColumn);
              }
            }

            // save action
            const fnSave = () => {
              // var oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
              const bCompact = !!_oView.$().closest(".sapUiSizeCompact").length;

              // set busy
              _oDynamicDialog.setBusy(true);

              if (_oDynamicModel.hasPendingChanges()) {
                _oDynamicModel.submitChanges({
                  //   groupId: _sGroupId,
                  success: function (oData) {
                    _oDynamicDialog.setBusy(false);

                    let sMessage = "";
                    let bErrorFlag = false;

                    try {
                      const oBatchResponse = oData.__batchResponses[0];
                      if (oBatchResponse.response.statusCode === "400") {
                        let oResponseBody = JSON.parse(
                          oBatchResponse.response.body
                        );

                        sMessage = oResponseBody.error.message.value;
                        bErrorFlag = true;
                      }
                    } catch (error) {
                      /* no action required since there are no errors found */
                    }

                    if (bErrorFlag) {
                      MessageBox.error("Error", {
                        details: sMessage,
                        styleClass: bCompact ? "sapUiSizeCompact" : "",
                      });
                    } else {
                      MessageBox.success(
                        _bCreate
                          ? "Created successfully"
                          : "Changes saved successfully",
                        {
                          styleClass: bCompact ? "sapUiSizeCompact" : "",
                        }
                      );
                      _oDynamicDialog.close();

                      // clear table selections
                      _oDynamicTable.clearSelection();
                    }

                    _oDynamicDialogNewItemContext = null;

                    // clear page edit
                    _oViewModel.setProperty("/isPageEditable", false);
                  }.bind(this),
                  error: function (_oError) {
                    _oDynamicDialog.setBusy(false);
                    _oDynamicDialog.close();
                    MessageBox.error(
                      _bCreate
                        ? "Error in creation"
                        : "Error in saving the changes",
                      {
                        styleClass: bCompact ? "sapUiSizeCompact" : "",
                      }
                    );
                  },
                });
              } else {
                MessageBox.success("No changes found to save", {
                  styleClass: bCompact ? "sapUiSizeCompact" : "",
                });
                _oDynamicDialog.setBusy(false);
                _oDynamicDialog.close();
              }
            };

            // dynamic dialog
            const fnDynamicDialog = () => {
              if (!_oDynamicDialog) {
                let aFormContent = [];

                // dynamic properties
                for (const dyanamicField of _aDynamicFields) {
                  let aContent = [];
                  let oTemplateLItem;
                  let oControl;

                  // label
                  aContent.push(new Label({ text: dyanamicField.label }));

                  // field
                  if (dyanamicField.name === "COUNTRY") {
                    oTemplateLItem = new ListItem({
                      key: "{Country>Country}",
                      text: "{Country>Country}",
                      additionalText: "{Country>Description}",
                    });
                    oControl = new ComboBox(dyanamicField.name, {
                      value: `{path: '${dyanamicField.name}',  mode: 'TwoWay'}`,
                      selectedKey: `{path: '${dyanamicField.name}',  mode: 'TwoWay'}`,
                      width: "100%",
                      showSecondaryValues: true,
                      mandatory: true,
                      items: {
                        path: "Country>/d/results",
                        templateShareable: false,
                        template: oTemplateLItem,
                      },
                    });
                    aContent.push(oControl);
                  } else if (dyanamicField.name === "CONDTYPE") {
                    oTemplateLItem = new ListItem({
                      key: "{CondType>vtext}",
                      text: "{CondType>kschl}",
                      additionalText: "{CondType>vtext}",
                    });
                    oControl = new ComboBox(dyanamicField.name, {
                      value: `{path: '${dyanamicField.name}',  mode: 'TwoWay'}`,
                      selectedKey: `{path: '${dyanamicField.name}',  mode: 'TwoWay'}`,
                      width: "100%",
                      showSecondaryValues: true,
                      mandatory: true,
                      items: {
                        path: "CondType>/d/results",
                        templateShareable: false,
                        template: oTemplateLItem,
                      },
                    });
                    aContent.push(oControl);
                  } else {
                    aContent.push(
                      new SmartField(dyanamicField.name, {
                        value: `{path: '${dyanamicField.name}', mode: 'TwoWay'}`,
                        mandatory: true,
                      })
                    );
                  }

                  aFormContent.push(aContent);
                }

                const oForm = new SimpleForm({
                  editable: true,
                  content: aFormContent,
                });

                _oDynamicDialog = new Dialog("dynamicDialogId", {
                  title: "Create new entry",
                  draggable: true,
                  content: oForm,
                  beginButton: new Button({
                    text: "Save",
                    type: ButtonType.Emphasized,
                    press: fnSave,
                  }),
                  endButton: new Button({
                    text: "Cancel",
                    press: () => {
                      _oDynamicDialog.close();

                      // remove the context if not created
                      if (_bCreate) {
                        _oDynamicModel.deleteCreatedEntry(
                          _oDynamicDialogNewItemContext
                        );
                        _oDynamicDialogNewItemContext = null;

                        // clear input values before close
                        for (const dyanamicField of _aDynamicFields) {
                          try {
                            sap.ui
                              .getCore()
                              .byId(dyanamicField.name)
                              .setValue();
                          } catch (error) {
                            // fields not found
                          }
                        }
                      }
                    },
                  }),
                }).addStyleClass("sapUiSizeCompact");

                //to get access to the controller's model
                _oView.addDependent(_oDynamicDialog);
              }

              // set model
              _oDynamicDialog.setModel(_oDynamicModel);
            };

            // load dynamic dialog
            fnDynamicDialog();

            // create action
            const fnCreate = () => {
              let properties = {};

              // dynamic properties
              for (const dyanamicField of _aDynamicFields) {
                properties[dyanamicField.name] = "";
              }

              const mParameters = {
                properties,
                groupId: _sGroupId,
              };

              // create new context for save
              _oDynamicDialogNewItemContext = _oDynamicModel.createEntry(
                `/${sEntity}`,
                mParameters
              );

              // create flag
              _bCreate = true;

              // set title
              sap.ui
                .getCore()
                .byId("dynamicDialogId")
                .setTitle("Create New Entry");

              // dynamic properties
              for (const dyanamicField of _aDynamicFields) {
                sap.ui.getCore().byId(dyanamicField.name).setEditable(true);
              }

              // set binding context
              _oDynamicDialog.bindElement(
                _oDynamicDialogNewItemContext.getPath()
              );

              // open dialog
              setTimeout(() => _oDynamicDialog.open(), 250);
            };

            // edit action
            const fnEdit = () => {
              if (_oDynamicTable.getSelectedIndices().length > 1) {
                MessageToast.show("Row selection should not be more than one!");
                return;
              }

              // create flag
              _bCreate = false;

              // set title
              sap.ui
                .getCore()
                .byId("dynamicDialogId")
                .setTitle("Edit Description");

              // dynamic properties
              for (const dyanamicField of _aDynamicFields) {
                if (dyanamicField.name !== "SAP_Description")
                  sap.ui.getCore().byId(dyanamicField.name).setEditable(false);
              }

              // get selected binding context
              const oBindingContext = _oDynamicTable.getContextByIndex(
                _oDynamicTable.getSelectedIndex()
              );

              const parameters = {
                groupId: _sGroupId,
              };

              // set binding context
              _oDynamicDialog.bindElement(
                oBindingContext.getPath(),
                parameters
              );

              // open dialog
              setTimeout(() => _oDynamicDialog.open(), 250);
            };

            // delete action
            const fnDelete = () => {
              const bCompact = !!_oView.$().closest(".sapUiSizeCompact").length;

              // check any row is selected before
              MessageBox.confirm(
                "Are you sure, you want to delete selected item?",
                {
                  actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                  emphasizedAction: MessageBox.Action.OK,
                  styleClass: bCompact ? "sapUiSizeCompact" : "",
                  onClose: (sAction) => {
                    if (sAction !== MessageBox.Action.OK) {
                      return;
                    }

                    // set busy status
                    _oDynamicDialog.setBusy(true);

                    // odata delete call
                    for (const index of _oDynamicTable.getSelectedIndices()) {
                      // get selected binding context
                      const oBindingContext = _oDynamicTable.getContextByIndex(
                        index
                      );
                      // set batch process for deletion of rows
                      _oDynamicModel.remove(oBindingContext.getPath(), {
                        groupId: _sGroupId,
                      });
                    }

                    // save the batch changes
                    _oDynamicModel.submitChanges({
                      groupId: _sGroupId,
                      success: function () {
                        MessageBox.success("Deleted Successfully", {
                          styleClass: bCompact ? "sapUiSizeCompact" : "",
                        });
                        _oDynamicDialog.setBusy(false);
                      },
                      error: function (oErrorResponse) {
                        MessageBox.error("Error in deletion", {
                          details: oErrorResponse.toString(),
                          styleClass: bCompact ? "sapUiSizeCompact" : "",
                        });
                        _oDynamicDialog.setBusy(false);
                      },
                    });
                  },
                }
              );
            };

            // set toolbar header of the table
            _oDynamicTable.setToolbar(
              new Toolbar({
                content: [
                  new Title("tableTitleId", {
                    text: `${_aHeaderDetails[0].title}`,
                  }),
                  new ToolbarSpacer(),
                  new Button({
                    text: "Create",
                    visible: "{objectView>/isPageEditable}",
                    press: fnCreate,
                  }),
                  new Button({
                    text: "Edit",
                    visible: "{objectView>/isPageEditable}",
                    enabled: "{objectView>/isMinRowSelected}",
                    press: fnEdit,
                  }),
                  new Button({
                    text: "Delete",
                    type: ButtonType.Emphasized,
                    visible: "{objectView>/isPageEditable}",
                    enabled: "{objectView>/isMinRowSelected}",
                    press: fnDelete,
                  }),
                ],
              })
            );

            _oDynamicTable.setModel(_oDynamicModel);

            _oDynamicTable.bindRows({
              path: `/${sEntity}`,
              events: {
                dataReceived: (_) => {
                  try {
                    // set busy indicator
                    _oViewModel.setProperty("/busy", false);
                    // update table count
                    sap.ui
                      .getCore()
                      .byId("tableTitleId")
                      .setText(
                        `${_aHeaderDetails[0].title} 
                        (${_.getParameter("data").results.length})`
                      );
                  } catch (error) {
                    // table title is not updated
                  }
                },
              },
            });

            // add dynamic table to container
            _oDynamicTableContainer.addItem(_oDynamicTable);
          } catch (error) {
            debugger;
            // set busy indicator
            _oViewModel.setProperty("/busy", false);
          }
        });
      },
    });
  }
);
