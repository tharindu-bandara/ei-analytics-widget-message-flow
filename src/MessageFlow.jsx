import React from 'react';
import Widget from '@wso2-dashboards/widget';
import $ from 'jquery';
import dagreD3 from 'dagre-d3';
import * as d3 from 'd3';
import './custom.css';
import aggregatorDataProviderConf from './resources/aggregatorDataProviderConf.json';
import configEntryDataProviderConf from './resources/configEntryDataProviderConf.json';
import messageFlowStreamEventDataProviderConf from './resources/messageFlowStreamEventDataProviderConf.json';
import {withStyles} from '@material-ui/core/styles';
import CircularProgress from '@material-ui/core/CircularProgress';
import moment from 'moment';
import nanoScroller from 'nanoscroller/bin/javascripts/jquery.nanoscroller';

var TYPE_MEDIATOR = 'mediator';
var TYPE_SEQUENCE = 'sequences';
var TYPE_ENDPOINT = 'endpoint';
var DASHBOARD_NAME = 'eianalytics';
var TYPE_PROXY = "proxy";
var TYPE_API = "api";
var TYPE_INBOUND_ENDPOINT = "inbound";
var TYPE_MESSAGE = "message";
var TENANT_ID = "-1234";
var CONFIG_ENTRY_TABLE = "configEntry";
var TABLE_DATA_UNAVAILABLE = "table data unavailable";
var CONFIG_ENTRY_TABLE = 'configEntry';

var BASE_URL = getDashboardBaseUrl();

var MEDIATOR_PAGE_URL = BASE_URL + TYPE_MEDIATOR;
var SEQUENCE_PAGE_URL = BASE_URL + TYPE_SEQUENCE;
var ENDPOINT_PAGE_URL = BASE_URL + TYPE_ENDPOINT;
var configs = [
    {name: TYPE_PROXY, type: 10},
    {name: TYPE_API, type: 15},
    {name: TYPE_MESSAGE, type: 22},
    {name: TYPE_SEQUENCE, type: 32},
    {name: TYPE_INBOUND_ENDPOINT, type: 37}
];

var centerDiv = {
    textAlign: 'center',
    verticalAlign: 'middle'
};

class MessageFlow extends Widget {
    constructor(props) {
        super(props);
        this.domElementCanvas = React.createRef();
        this.domElementSvg = React.createRef();
        this.domElementNano = React.createRef();
        this.domElementBtnZoomIn = React.createRef();
        this.domElementBtnZoomOut = React.createRef();
        this.domElementBtnZoomFit = React.createRef();
        this.domElementImage = React.createRef();
        this.domElementWaiting = React.createRef();

        this.parameters = {
            timeFrom: null,
            timeTo: null,
            timeUnit: null,
            entryName: null,
            meta_tenantId: '-1234'
        };
        this.handleRecievedMessage = this.handleMessage.bind(this);

        this.state = {
            dataUnavailable: true,
            height: props.height,
            width: props.width
        };
    }

    /**
     * Given data array for a message flow, draw message flow in the svg component
     *
     * @param $ Jquery selector
     * @param data Data array for the message flow
     */
    drawMessageFlow($, data) {
        var hiddenLineStyle;
        if (this.detectIE() !== false) {
            hiddenLineStyle = 'display: none;';
        }
        else {
            hiddenLineStyle = 'stroke-width: 0px;';
        }
        if (data.length === 0) {
            $(this.domElementCanvas.current).html(this.getEmptyRecordsText());
            return;
        }
        var groups = [];
        $(this.domElementCanvas.current).empty();
        var nodes = data;

        // Create the input graph
        var g = new dagreD3.graphlib.Graph({compound: true})
            .setGraph({rankdir: "LR"})
            .setDefaultEdgeLabel(function () {
                return {};
            });

        for (var i = 0; i < nodes.length; i++) {
            if (nodes[i].id != null) {
                //Set Nodes
                if (nodes[i].type === "group") {
                    g.setNode(nodes[i].id, {label: "", clusterLabelPos: 'top'});

                    //Add arbitary nodes for group
                    g.setNode(nodes[i].id + "-s", {label: nodes[i].label, style: hiddenLineStyle});
                    // g.setEdge(nodes[i].id + "-s", nodes[i].id + "-e",  { style: 'display: none;; fill: #ffd47f'});
                    g.setNode(nodes[i].id + "-e", {label: "", style: hiddenLineStyle});
                    g.setParent(nodes[i].id + "-s", nodes[i].id);
                    g.setParent(nodes[i].id + "-e", nodes[i].id);

                    groups.push(nodes[i]);
                } else {
                    var label = this.buildLabel(nodes[i], $);
                    g.setNode(nodes[i].id, {labelType: "html", label: label});
                    // g.setNode(nodes[i].id, {label: nodes[i].label});
                }

                //Set Edges
                if (nodes[i].parents != null) {
                    for (var x = 0; x < nodes[i].parents.length; x++) {
                        var isParentGroup = false;
                        for (var y = 0; y < groups.length; y++) {
                            if (groups[y].id === nodes[i].parents[x] && groups[y].type === "group") {
                                isParentGroup = true;
                            }
                        }

                        if (nodes[i].type === "group") {
                            if (isParentGroup) {
                                g.setEdge(nodes[i].parents[x] + "-e", nodes[i].id + "-s", {
                                    lineInterpolate: 'basis',
                                    arrowheadClass: 'arrowhead'
                                });
                            } else {
                                g.setEdge(nodes[i].parents[x], nodes[i].id + "-s", {
                                    lineInterpolate: 'basis',
                                    arrowheadClass: 'arrowhead'
                                });
                            }
                        } else {
                            if (isParentGroup) {
                                g.setEdge(nodes[i].parents[x] + "-e", nodes[i].id, {
                                    lineInterpolate: 'basis',
                                    arrowheadClass: 'arrowhead'
                                });
                            } else {
                                g.setEdge(nodes[i].parents[x], nodes[i].id, {
                                    lineInterpolate: 'basis',
                                    arrowheadClass: 'arrowhead'
                                });
                            }
                        }
                    }
                }

                if (nodes[i].group != null) {
                    g.setParent(nodes[i].id, nodes[i].group);
                    if (nodes[i].type !== "group" && !this.isParent(nodes, nodes[i])) {
                        g.setEdge(nodes[i].group + "-s", nodes[i].id, {style: hiddenLineStyle});
                        g.setEdge(nodes[i].id, nodes[i].group + "-e", {style: hiddenLineStyle});
                    }


                }

            }

        }

        g.nodes().forEach(function (v) {
            var node = g.node(v);

            node.rx = node.ry = 7;
        });

        // Create the renderer
        var render = new dagreD3.render();

        $(this.domElementSvg.current).empty();

        var svg = d3.select(this.domElementSvg.current);
        svg.append("g");
        var inner = svg.select("g"),
            zoom = d3.zoom().on("zoom", function () {
                svg.select('g').attr("transform", d3.event.transform)
            });

        svg.call(zoom);
        var nanoScrollerSelector = $(this.domElementNano.current);
        nanoScrollerSelector.nanoScroller();
        inner.call(render, g);

        // Zoom and scale to fit
        var graphWidth = g.graph().width + 10;
        var graphHeight = g.graph().height + 10;
        // var width = parseInt(svg.style("width").replace(/px/, ""));
        // var height = parseInt(svg.style("height").replace(/px/, ""));
        var width = this.state.width; //todo: Use correct window sizes from SP
        var height = this.state.height; //todo: Use correct window sizes from SP
        var zoomScale = Math.min(width / graphWidth, height / graphHeight);
        var translate = [0, 0];

        svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity.scale(zoomScale));
        svg.attr('width', width);
        svg.attr('height', height);
        // svg.select('g').attr('width')
        // zoom.event(isUpdate ? svg.transition().duration(500) : d3.select("svg"));
        //zoom.event(svg);
        // todo: Fix zooming for buttons
        d3.selectAll(this.domElementBtnZoomIn.current).on('click', function () {
            zoomScale += 0.05;
            this.interpolateZoom(translate, zoomScale, inner, zoom);
        });

        d3.selectAll(this.domElementBtnZoomOut.current).on('click', function () {
            if (zoomScale > 0.05) {
                zoomScale -= 0.05;
                this.interpolateZoom(translate, zoomScale, inner, zoom);
            }

        });

        d3.selectAll(this.domElementBtnZoomFit.current).on('click', function () {
            var zoomScale = Math.min(width / graphWidth, height / graphHeight);
            var translate = [(width / 2) - ((graphWidth * zoomScale) / 2), (height / 2) - ((graphHeight * zoomScale) / 2) * 0.93];
            zoom.translate(translate);
            zoom.scale(zoomScale);
            zoom.event(svg);
        });
    }

    /**
     * Extract most recent entry point message flow data array for a given component from the database for
     * proxy, api and inbound endpoint message flows
     *
     * @param timeFrom Time duration start position
     * @param timeTo Time duration end position
     * @param timeUnit Per which time unit, data should be retrieved(minutes, seconds etc)
     * @param entryName Name of the component
     * @param pageType Page name required for the message flow drawing
     */
    extractEntryPointMessageFlowData(timeFrom, timeTo, timeUnit, entryName, tenantId) {

        // Extract latest configEntry data row from the datastore
        this.setState({
            dataUnavailable: true
        });
        this.callBackFunction = this.handleConfigEntryData(timeUnit, timeFrom, timeTo, tenantId, entryName).bind(this);
        let query = this.getConfigEntryDataProviderConf(entryName, tenantId, timeFrom, timeTo);
        console.log(JSON.stringify(query));
        super.getWidgetChannelManager().subscribeWidget(
            this.props.id,
            this.callBackFunction,
            query
        );
    }

    /**
     * Message flow data extraction
     */
    extractMessageFlow(messageId, meta_tenantId) {

        // Prepare query to read from event stream table
        let dataProviderConfigs = this.getProviderConf(messageFlowStreamEventDataProviderConf);
        let query = dataProviderConfigs.configs.config.queryData.query;
        query = query
            .replace("{{messageFlowId}}", messageId)
            .replace("{{meta_tenantId}}", meta_tenantId);
        dataProviderConfigs.configs.config.queryData.query = query;

        // Query from the table
        console.log(JSON.stringify(query));
        super.getWidgetChannelManager().subscribeWidget(
            this.props.id,
            this.handleMessageFlowEventStreamData(meta_tenantId).bind(this),
            query
        );
    }

    handleMessageFlowEventStreamData(meta_tenantId) {
        return function (components) {
            if (components[0] != null && components[0]["values"] != null) {
                var entryPointHashCode = components[0]["values"]["entryPointHashcode"];
                var entryPoint = components[0]["values"]["entryPoint"];

                // Read only one entry from configEntry table
                let dataProviderConfigs = this.getProviderConf(messageFlowConfigEntryDataProviderConf);
                let query = dataProviderConfigs.configs.config.queryData.query;
                query = query
                    .replace("{{hashcode}}", entryPointHashCode)
                    .replace("{{meta_tenantId}}", meta_tenantId);
                dataProviderConfigs.configs.config.queryData.query = query;

                // Query from the table
                this.super.getWidgetChannelManager().subscribeWidget(
                    this.props.id,
                    this.handleMessageFlowConfigEntryData(components).bind(this),
                    query
                );
            }
            else {
                // todo: Handle null data scenario
            }
        }
    }

    handleMessageFlowConfigEntryData(components) {
        return function (config) {
            // Get all sequence components hashcodes
            let sequenceHashcodes = [];
            components.forEach((component) => {
                if (component[componentInfo] == "Sequence") {
                    sequenceHashcodes.push(component["hashCode"]);
                }
            });
            let dataProviderConfigs = this.getProviderConf(messageFlowComponentConfigEntryDataProviderConf);
            let query = dataProviderConfigs.configs.config.queryData.query;
            query = query
                .replace("{{hashcodeArray}}", sequenceHashcodes)
                .replace("{{meta_tenantId}}", meta_tenantId);
            dataProviderConfigs.configs.config.queryData.query = query;

            // Query from the table
            this.super.getWidgetChannelManager().subscribeWidget(
                this.props.id,
                this.handleMessageFlowComponentConfigEntryData(components, config).bind(this),
                query
            );
        }
    }

    handleMessageFlowComponentConfigEntryData(components, config) {
        return function (seqConfigs) {
            // todo: seqConfigs contain configEntries with hashcodes. Use this data to fix schema injecting
            var schema = JSON.parse(config["values"]["configData"]);

            // Prepare component map
            var componentMap = {};
            if (components != null) {
                for (var i = 0; i < components.length; i++) {
                    var component = components[i];
                    var componentInfo = component["values"];

                    if (componentInfo != null) {
                        var componentId = componentInfo["componentId"];

                        // get schema of referenced sequences and add it to the overall schema
                        if ("Sequence" == componentInfo["componentType"]) {
                            var query = stringify({
                                "query": "_hashcode : \"" + componentInfo["hashCode"] + "\" AND meta_tenantId : [" + tenantId + " TO " + tenantId + "]",
                                "start": 0,
                                "count": 1
                            });
                            var seqConfigResp = connector.search(superTenantId, tableName, query);
                            var seqConfig = JSON.parse(seqConfigResp.getMessage())[0];
                            if (seqConfig != null) {
                                var seqSchema = JSON.parse(seqConfig["values"]["configData"]);
                                for (var j = 0; j < seqSchema.length; j++) {
                                    schema.push(seqSchema[j]);
                                }
                            }
                        }
                        componentMap[componentId] = componentInfo;
                    }
                }
            }

            var removedComponents = [];
            // Populate table data
            var componentNameRegex = new RegExp("^.*@\\d*:(.*)");
            var groups = [];
            var compIds = [];
            for (var i = 0; i < schema.length; i++) {
                var groupLabel;
                if (schema[i] != null) {
                    var groupId = schema[i]["group"];
                    var componentId = schema[i]["id"];

                    var isIndirectComponent = componentId.indexOf("@indirect");
                    var originalCompId = componentId;
                    if (isIndirectComponent > 0) {
                        // PaymentServiceEp@14:PaymentServiceEp@indirect --> PaymentServiceEp@0:PaymentServiceEp
                        var splitByAt = componentId.split("@"); // ["PaymentServiceEp", "14:PaymentServiceEp", "indirect"]
                        var splitByColon = splitByAt[1].split(":"); // ["14", "PaymentServiceEp"]
                        componentId = splitByAt[0] + "@0:" + splitByColon[1];
                        for (var j = 0; j < schema.length; j++) {
                            if (schema[j] != null) {
                                var componentIdTmp = schema[j]["id"];
                                var componentIdParentTmp = schema[j]["parentId"];
                                var tempGroupId = schema[j]["group"];
                                if (componentIdTmp == componentId) {
                                    schema[j]["id"] = originalCompId;
                                }
                                if (componentIdParentTmp == componentId) {
                                    schema[j]["parentId"] = originalCompId;
                                }
                                if (tempGroupId == componentId) {
                                    schema[j]["group"] = originalCompId;
                                }
                            }
                        }
                    }

                    var componentInfo = null;
                    if (componentId != null) {
                        componentInfo = componentMap[componentId];
                    }
                    var dataAttributes = [];
                    var hiddenAttributes = [];
                    var componentLabel = componentNameRegex.exec(componentId)[1];

                    // Find unique groups
                    if (schema[i]["group"] != null && groups.indexOf(schema[i]["group"]) == -1) {
                        groups.push(schema[i]["group"]);
                    }


                    // Create data attributes
                    if (componentInfo != null) {
                        dataAttributes.push({"name": "Duration", "value": componentInfo["duration"]});
                        if (componentInfo["faultCount"] == 0) {
                            dataAttributes.push({"name": "Status", "value": "Success"});
                        } else {
                            dataAttributes.push({"name": "Status", "value": "Failed"});
                        }
                        componentType = componentInfo["componentType"];
                        hashCode = componentInfo["hashCode"];

                        hiddenAttributes.push({"name": "entryPoint", "value": entryPoint});
                        hiddenAttributes.push({"name": "hashCode", "value": hashCode});

                        // for Sequences and Endpoints, id should be the "name", since name is used for drill down searches
                        if (componentType == "Endpoint" || componentType == "Sequence") {
                            hiddenAttributes.push({"name": "id", "value": componentLabel});
                        } else {
                            hiddenAttributes.push({"name": "id", "value": componentId});
                        }

                        var compId = schema[i]["id"];
                        var parentId = schema[i]["parentId"];
                        if (compIds.indexOf(compId) < 0) {
                            compIds.push(compId);
                        }
                        if (parentId != null && (compIds.indexOf(parentId) < 0)) {
                            var matchingParentId;

                            // This logic traverse towards the root of the configuration tree from
                            // the current node, until it finds the parent of the node or any ancestor node
                            // exists within the message flow. If any node found, it assigns the node as
                            // its parent.  This link is used to draw the message flow.
                            for (var j = 1; j < schema.length; j++) {
                                if (compIds.indexOf(schema[i - j]["parentId"]) != -1) {
                                    matchingParentId = schema[i - j]["parentId"];
                                    break;
                                }
                            }
                            tmpResult.push({
                                "id": originalCompId,
                                "label": componentLabel,
                                "parents": [matchingParentId],
                                "group": schema[i]["group"],
                                "type": componentType,
                                "dataAttributes": dataAttributes,
                                "hiddenAttributes": hiddenAttributes,
                                "modifiedId": componentId
                            });
                        } else if (schema[i]["parentId"] == schema[i]["group"]) {
                            tmpResult.push({
                                "id": originalCompId,
                                "label": componentLabel,
                                "parents": [],
                                "group": schema[i]["group"],
                                "type": componentType,
                                "dataAttributes": dataAttributes,
                                "hiddenAttributes": hiddenAttributes,
                                "modifiedId": componentId
                            });
                        } else {
                            tmpResult.push({
                                "id": originalCompId,
                                "label": componentLabel,
                                "parents": [schema[i]["parentId"]],
                                "group": schema[i]["group"],
                                "type": componentType,
                                "dataAttributes": dataAttributes,
                                "hiddenAttributes": hiddenAttributes,
                                "modifiedId": componentId
                            });
                        }
                    } else {
                        removedComponents.push(componentId);
                    }
                }
            }
            compIds = null;

            // Cleanup
            for (var k = 0; k < tmpResult.length; k++) {
                var group = tmpResult[k]["group"];
                var parentId = tmpResult[k]["parents"];
                if (removedComponents.indexOf(group) == -1 && removedComponents.indexOf(parentId[0]) == -1) {
                    result.push(tmpResult[k]);
                }
            }


            for (var j = 0; j < result.length; j++) {
                if (groups.indexOf(result[j]["id"]) >= 0) {
                    result[j]["type"] = "group";
                }
            }
        }
    }

    getConfigEntryDataProviderConf(entryName, meta_tenantId, timeFrom, timeTo) {
        let dataProviderConfigs = this.getProviderConf(configEntryDataProviderConf);
        let query = dataProviderConfigs.configs.config.queryData.query;
        query = query
            .replace("{{entryName}}", entryName)
            .replace("{{meta_tenantId}}", meta_tenantId)
            .replace("{{timeFrom}}", timeFrom)
            .replace("{{timeTo}}", timeTo)
        console.warn(timeFrom, timeTo);
        dataProviderConfigs.configs.config.queryData.query = query;
        return dataProviderConfigs;
    }

    getAggregateDataProviderConf(timeUnit, timeFrom, timeTo, tenantId, hashcode) {
        let dataProviderConfigs = this.getProviderConf(aggregatorDataProviderConf);
        let query = dataProviderConfigs.configs.config.queryData.query;
        query = query
            .replace("{{timeUnit}}", timeUnit)
            .replace("{{hashcode}}", '\'' + hashcode + '\'')
            .replace("{{tenantId}}", tenantId)
            .replace("{{timeTo}}", timeTo)
            .replace("{{timeFrom}}", timeFrom)
        console.warn(query);
        dataProviderConfigs.configs.config.queryData.query = query;
        return dataProviderConfigs;
    }

    handleConfigEntryData(timeUnit, timeFrom, timeTo, tenantId, entryName) {
        return function (configEntryData) {
            if (configEntryData) {
                let hashcodeIndex = configEntryData.metadata.names.indexOf("hashcode");

                let hashcodeData = configEntryData.data[0][hashcodeIndex];
                this.getWidgetChannelManager().subscribeWidget(
                    this.props.id,
                    this.handleAggregateData(configEntryData, entryName).bind(this),
                    this.getAggregateDataProviderConf(timeUnit, timeFrom, timeTo, tenantId, hashcodeData)
                );
            } else {
                // todo: Handle missing configEntry data
            }
        }
    }

    handleAggregateData(configEntryData, entryName) {
        return function (aggregateData) {
            if (aggregateData) {
                this.setState({
                    dataUnavailable: false
                });
                // Read and store column names and the position mapping in the data arrays
                let configEntryDataTableIndex = {};
                configEntryData.metadata.names.forEach((value, index) => {
                    configEntryDataTableIndex[value] = index;
                })

                // console.log(aggregateData);
                let schema = JSON.parse(configEntryData.data[0][configEntryDataTableIndex["configData"]]);

                // Aggregate table and prepare component map
                var result = [];
                var componentMap = {};
                var fields = ["invocations", "totalDuration", "maxDuration", "faults"];
                var table = aggregateData.data;
                if (table != null && table.length !== 0) {
                    for (var j = 0; j < table.length; j++) {
                        var componentInfo = {};

                        // Replace number based indexing with label names
                        var row = table[j];
                        aggregateData.metadata.names.forEach((value, index) => {
                            componentInfo[value] = row[index];
                        })
                        var componentId = componentInfo["componentId"];
                        if (componentMap[componentId] == null) {
                            componentMap[componentId] = componentInfo;
                        } else {
                            for (var field in fields) {
                                fieldName = fields[field];
                                componentMap[componentId][fieldName] = componentMap[componentId][fieldName]
                                    + componentInfo[fieldName];
                            }
                        }
                    }
                }

                // Populate table data
                var componentNameRegex = new RegExp("^.*@\\d*:(.*)"); // Eg: HealthCareAPI@9:Resource
                var groups = [];
                for (var i = 0; i < schema.length; i++) {
                    var groupLabel;
                    if (schema[i] != null) {
                        var groupId = schema[i]["group"];
                        var componentId = schema[i]["id"];


                        /** change component id when @indirect presents **/
                        var isIndirectComponent = componentId.indexOf("@indirect"); // todo:Clarify

                        var originalCompId = componentId;

                        if (isIndirectComponent > 0) {

                            // PaymentServiceEp@14:PaymentServiceEp@indirect --> PaymentServiceEp@0:PaymentServiceEp

                            var splitByAt = componentId.split("@"); // ["PaymentServiceEp", "14:PaymentServiceEp", "indirect"]
                            var splitByColon = splitByAt[1].split(":"); // ["14", "PaymentServiceEp"]

                            componentId = splitByAt[0] + "@0:" + splitByColon[1];
                            /*
                                If any remaining entries in the schema has same name part'indirect',
                                replace it with the newly generated component id
                             */
                            for (var j = 0; j < schema.length; j++) {
                                if (schema[j] != null) {
                                    var componentIdTmp = schema[j]["id"];
                                    var componentIdParentTmp = schema[j]["parentId"];
                                    var tempGroupId = schema[j]["group"];
                                    if (componentIdTmp === componentId) {
                                        schema[j]["id"] = originalCompId;
                                    } else if (componentIdParentTmp === componentId) {
                                        schema[j]["parentId"] = originalCompId;
                                    }
                                    if (tempGroupId === componentId) {
                                        schema[j]["group"] = originalCompId;
                                    }
                                }
                            }
                        }


                        var componentInfo = componentMap[componentId];
                        var dataAttributes = [];

                        // Find unique groups
                        if (schema[i]["group"] != null && groups.indexOf(schema[i]["group"]) === -1) {
                            groups.push(schema[i]["group"]);
                        }

                        // Create data attributes
                        for (var field in fields) {
                            var fieldName = fields[field];
                            if (componentInfo != null) {
                                if (fieldName === "totalDuration") {
                                    dataAttributes.push({ // Get the average values of multiple entries of the same path
                                        "name": "AvgDuration",
                                        "value": (componentInfo[fieldName] / componentInfo["invocations"]).toFixed(2)
                                    });
                                } else {
                                    dataAttributes.push({"name": fieldName, "value": componentInfo[fieldName]});
                                }
                            } else {
                                dataAttributes.push({"name": fieldName, "value": 0});
                            }
                        }

                        var componentLabel = componentNameRegex.exec(componentId)[1];
                        if (componentInfo != null) {
                            var componentType = componentInfo["componentType"];
                        } else {
                            componentType = "UNKNOWN";
                        }

                        // Create hidden attributes
                        var hiddenAttributes = [];
                        hiddenAttributes.push({"name": "entryPoint", "value": entryName.slice(1, -1)});
                        if (componentType === "Endpoint" || componentType === "Sequence") {
                            hiddenAttributes.push({"name": "id", "value": componentLabel});
                        } else {
                            hiddenAttributes.push({"name": "id", "value": componentId});
                        }

                        if (schema[i]["parentId"] === schema[i]["group"]) {
                            result.push({
                                "id": originalCompId,
                                "label": componentLabel,
                                "parents": [],
                                "group": schema[i]["group"],
                                "type": componentType,
                                "dataAttributes": dataAttributes,
                                "hiddenAttributes": hiddenAttributes,
                                "modifiedId": componentId
                            });
                        } else {
                            result.push({
                                "id": originalCompId,
                                "label": componentLabel,
                                "parents": [schema[i]["parentId"]],
                                "group": schema[i]["group"],
                                "type": componentType,
                                "dataAttributes": dataAttributes,
                                "hiddenAttributes": hiddenAttributes,
                                "modifiedId": componentId
                            });
                        }
                    }
                }
                // Defining groups
                for (var j = 0; j < result.length; j++) {
                    if (groups.indexOf(result[j]["id"]) >= 0) {
                        result[j]["type"] = "group";
                    }
                }

                // Draw message flow with the processed data
                // console.log(result);
                // console.log(JSON.stringify(result));
                this.drawMessageFlow($, result);
            } else {
                // todo : handle this no data returned situation
            }
        }
    }

    getProviderConf(aggregatorDataProviderConf) {
        let stringifiedDataProvideConf = JSON.stringify(aggregatorDataProviderConf);
        return JSON.parse(stringifiedDataProvideConf);
    }

    detectIE() {
        var ua = window.navigator.userAgent;

        var msie = ua.indexOf('MSIE ');
        if (msie > 0) {
            // IE 10 or older => return version number
            return parseInt(ua.substring(msie + 5, ua.indexOf('.', msie)), 10);
        }

        var trident = ua.indexOf('Trident/');
        if (trident > 0) {
            // IE 11 => return version number
            var rv = ua.indexOf('rv:');
            return parseInt(ua.substring(rv + 3, ua.indexOf('.', rv)), 10);
        }

        var edge = ua.indexOf('Edge/');
        if (edge > 0) {
            // Edge (IE 12+) => return version number
            return parseInt(ua.substring(edge + 5, ua.indexOf('.', edge)), 10);
        }

        // other browser
        return false;
    }

    buildLabel(node, $) {
        var pageUrl = MEDIATOR_PAGE_URL;
        if (node.type === "Sequence") {
            pageUrl = SEQUENCE_PAGE_URL;
        } else if (node.type === "Endpoint") {
            pageUrl = ENDPOINT_PAGE_URL;
        }
        var hashCode = "";
        var hiddenParams = '';
        if (node.hiddenAttributes) {
            node.hiddenAttributes.forEach(function (item, i) {
                hiddenParams += '&' + item.name + '=' + item.value;
                if (item.name === "hashCode") {
                    hashCode = item.value;
                }
            });
        }
        var targetUrl = pageUrl + '?' + hiddenParams;
        // console.log("Test : " + targetUrl);
        var labelText;

        if (node.dataAttributes) {
            var nodeClasses = "nodeLabel";
            var nodeWrapClasses = "nodeLabelWrap"

            if (node.dataAttributes[1].value === "Failed") {
                nodeClasses += " failed-node";
                nodeWrapClasses += " failed-node";

            }
            var icon;
            if (node.type.toLowerCase() === 'mediator') {

                var mediatorName = node.label.split(':')[0].toLowerCase();

                var imgURL = '/portal/public/app/images/mediators/' + mediatorName + '.svg';
                var defaultImgURL = '/portal/public/app/images/mediators/mediator.svg';

                icon = '<img class="mediator-icon" src="' + imgURL + '" onerror="this.src="' + defaultImgURL + '">';
            } else if (node.type.toLowerCase() === 'endpoint') {
                icon = '<i class="icon endpoint-icon fw fw-endpoint"></i>';
            } else {
                icon = '';
            }

            // todo: Add functionality to the target URL(When a node is clicked, add necessary functionality)
            labelText = '<a href="#" class="' + nodeWrapClasses + '">' + icon + '<div class="' + nodeClasses + '" data-node-type="' + node.type + '" data-component-id="' + node.modifiedId
                + '" data-hash-code="' + hashCode + '" data-target-url="' + targetUrl + '"><h4>' + node.label + "</h4>";

            node.dataAttributes.forEach(function (item, i) {
                labelText += "<h5><label>" + item.name + " : </label><span>" + item.value + "</span></h5>";
            });
        }
        labelText += "</div></a>";
        return labelText;
    };

    interpolateZoom(translate, scale, svg, zoom) {
        //var self = this;
        return d3.transition().duration(350).tween("zoom", function () {
            var iTranslate = d3.interpolate(zoom.translate(), translate),
                iScale = d3.interpolate(zoom.scale(), scale);
            return function (t) {
                zoom.scale(iScale(t)).translate(iTranslate(t));
                svg.attr("transform", d3.event.transform)
            };
        });
    }

    isParent(searchNodes, id) {
        for (var x = 0; x < searchNodes.length; x++) {
            if (searchNodes[x].parent === id) {
                return true;
            }
        }
        return false;
    }

    getEmptyRecordsText() {
        return '<div class="status-message">' +
            '<div class="message message-info">' +
            '<h4><i class="icon fw fw-info"></i>No records found</h4>' +
            '<p>Please select a valid date range to view stats.</p>' +
            '</div>' +
            '</div>';
    };

    shouldComponentUpdate() {
        return true;
    }

    componentWillMount() {
        super.subscribe(this.handleRecievedMessage);
    }

    handleMessage(recievedMessage) {
        console.log(JSON.stringify(message));
        let message;
        if (typeof recievedMessage == "string") {
            message = JSON.parse(recievedMessage);
        }
        else {
            message = recievedMessage;
        }

        if ("granularity" in message) {
            this.parameters.timeFrom = '\'' + moment(message.from).format("YYYY-MM-DD HH:mm:ss") + '\'';
            this.parameters.timeTo = '\'' + moment(message.to).format("YYYY-MM-DD HH:mm:ss") + '\'';
            this.parameters.timeUnit = '\'' + message.granularity + 's' + '\'';
        }

        if ("selectedComponent" in message) {
            this.parameters.entryName = '\'' + message.selectedComponent + '\'';
        }

        $(this.domElementSvg.current).empty();

        if (this.parameters.timeFrom != null
            && this.parameters.timeTo != null
            && this.parameters.timeUnit != null
            && this.parameters.entryName != null) {

            this.extractEntryPointMessageFlowData(
                this.parameters.timeFrom,
                this.parameters.timeTo,
                this.parameters.timeUnit,
                this.parameters.entryName,
                this.parameters.meta_tenantId
            );
        }
    }

    componentDidMount() {
        // // Sample data
        // var data = [{
        //     "id": "HealthcareAPI@0:HealthcareAPI",
        //     "label": "HealthcareAPI",
        //     "parents": [],
        //     "group": null,
        //     "type": "group",
        //     "dataAttributes": [{"name": "Invocations", "value": 2}, {
        //         "name": "AvgDuration",
        //         "value": "578.50"
        //     }, {"name": "MaxDuration", "value": 1060}, {"name": "Faults", "value": 0}],
        //     "hiddenAttributes": [{"name": "entryPoint", "value": "HealthcareAPI"}, {
        //         "name": "id",
        //         "value": "HealthcareAPI@0:HealthcareAPI"
        //     }],
        //     "modifiedId": "HealthcareAPI@0:HealthcareAPI"
        // }, {
        //     "id": "HealthcareAPI@1:Resource",
        //     "label": "Resource",
        //     "parents": [],
        //     "group": "HealthcareAPI@0:HealthcareAPI",
        //     "type": "group",
        //     "dataAttributes": [{"name": "Invocations", "value": 0}, {
        //         "name": "TotalDuration",
        //         "value": 0
        //     }, {"name": "MaxDuration", "value": 0}, {"name": "Faults", "value": 0}],
        //     "hiddenAttributes": [{"name": "entryPoint", "value": "HealthcareAPI"}, {
        //         "name": "id",
        //         "value": "HealthcareAPI@1:Resource"
        //     }],
        //     "modifiedId": "HealthcareAPI@1:Resource"
        // }, {
        //     "id": "HealthcareAPI@2:API_INSEQ",
        //     "label": "API_INSEQ",
        //     "parents": [],
        //     "group": "HealthcareAPI@1:Resource",
        //     "type": "group",
        //     "dataAttributes": [{"name": "Invocations", "value": 0}, {
        //         "name": "TotalDuration",
        //         "value": 0
        //     }, {"name": "MaxDuration", "value": 0}, {"name": "Faults", "value": 0}],
        //     "hiddenAttributes": [{"name": "entryPoint", "value": "HealthcareAPI"}, {
        //         "name": "id",
        //         "value": "HealthcareAPI@2:API_INSEQ"
        //     }],
        //     "modifiedId": "HealthcareAPI@2:API_INSEQ"
        // }, {
        //     "id": "HealthcareAPI@3:LogMediator",
        //     "label": "LogMediator",
        //     "parents": [],
        //     "group": "HealthcareAPI@2:API_INSEQ",
        //     "type": "UNKNOWN",
        //     "dataAttributes": [{"name": "Invocations", "value": 0}, {
        //         "name": "TotalDuration",
        //         "value": 0
        //     }, {"name": "MaxDuration", "value": 0}, {"name": "Faults", "value": 0}],
        //     "hiddenAttributes": [{"name": "entryPoint", "value": "HealthcareAPI"}, {
        //         "name": "id",
        //         "value": "HealthcareAPI@3:LogMediator"
        //     }],
        //     "modifiedId": "HealthcareAPI@3:LogMediator"
        // }, {
        //     "id": "HealthcareAPI@4:SendMediator",
        //     "label": "SendMediator",
        //     "parents": ["HealthcareAPI@3:LogMediator"],
        //     "group": "HealthcareAPI@2:API_INSEQ",
        //     "type": "group",
        //     "dataAttributes": [{"name": "Invocations", "value": 0}, {
        //         "name": "TotalDuration",
        //         "value": 0
        //     }, {"name": "MaxDuration", "value": 0}, {"name": "Faults", "value": 0}],
        //     "hiddenAttributes": [{"name": "entryPoint", "value": "HealthcareAPI"}, {
        //         "name": "id",
        //         "value": "HealthcareAPI@4:SendMediator"
        //     }],
        //     "modifiedId": "HealthcareAPI@4:SendMediator"
        // }, {
        //     "id": "QueryDoctorEP@5:QueryDoctorEP@indirect",
        //     "label": "QueryDoctorEP",
        //     "parents": [],
        //     "group": "HealthcareAPI@4:SendMediator",
        //     "type": "UNKNOWN",
        //     "dataAttributes": [{"name": "Invocations", "value": 0}, {
        //         "name": "TotalDuration",
        //         "value": 0
        //     }, {"name": "MaxDuration", "value": 0}, {"name": "Faults", "value": 0}],
        //     "hiddenAttributes": [{"name": "entryPoint", "value": "HealthcareAPI"}, {
        //         "name": "id",
        //         "value": "QueryDoctorEP@0:QueryDoctorEP"
        //     }],
        //     "modifiedId": "QueryDoctorEP@0:QueryDoctorEP"
        // }, {
        //     "id": "HealthcareAPI@6:API_OUTSEQ",
        //     "label": "API_OUTSEQ",
        //     "parents": ["HealthcareAPI@2:API_INSEQ"],
        //     "group": "HealthcareAPI@1:Resource",
        //     "type": "group",
        //     "dataAttributes": [{"name": "Invocations", "value": 0}, {
        //         "name": "TotalDuration",
        //         "value": 0
        //     }, {"name": "MaxDuration", "value": 0}, {"name": "Faults", "value": 0}],
        //     "hiddenAttributes": [{"name": "entryPoint", "value": "HealthcareAPI"}, {
        //         "name": "id",
        //         "value": "HealthcareAPI@6:API_OUTSEQ"
        //     }],
        //     "modifiedId": "HealthcareAPI@6:API_OUTSEQ"
        // }, {
        //     "id": "HealthcareAPI@7:SendMediator",
        //     "label": "SendMediator",
        //     "parents": [],
        //     "group": "HealthcareAPI@6:API_OUTSEQ",
        //     "type": "UNKNOWN",
        //     "dataAttributes": [{"name": "Invocations", "value": 0}, {
        //         "name": "TotalDuration",
        //         "value": 0
        //     }, {"name": "MaxDuration", "value": 0}, {"name": "Faults", "value": 0}],
        //     "hiddenAttributes": [{"name": "entryPoint", "value": "HealthcareAPI"}, {
        //         "name": "id",
        //         "value": "HealthcareAPI@7:SendMediator"
        //     }],
        //     "modifiedId": "HealthcareAPI@7:SendMediator"
        // }, {
        //     "id": "HealthcareAPI@8:API_FAULTSEQ",
        //     "label": "API_FAULTSEQ",
        //     "parents": ["HealthcareAPI@6:API_OUTSEQ"],
        //     "group": "HealthcareAPI@1:Resource",
        //     "type": "UNKNOWN",
        //     "dataAttributes": [{"name": "Invocations", "value": 0}, {
        //         "name": "TotalDuration",
        //         "value": 0
        //     }, {"name": "MaxDuration", "value": 0}, {"name": "Faults", "value": 0}],
        //     "hiddenAttributes": [{"name": "entryPoint", "value": "HealthcareAPI"}, {
        //         "name": "id",
        //         "value": "HealthcareAPI@8:API_FAULTSEQ"
        //     }],
        //     "modifiedId": "HealthcareAPI@8:API_FAULTSEQ"
        // }, {
        //     "id": "HealthcareAPI@9:Resource",
        //     "label": "Resource",
        //     "parents": [],
        //     "group": "HealthcareAPI@0:HealthcareAPI",
        //     "type": "group",
        //     "dataAttributes": [{"name": "Invocations", "value": 2}, {
        //         "name": "AvgDuration",
        //         "value": "572.00"
        //     }, {"name": "MaxDuration", "value": 1048}, {"name": "Faults", "value": 0}],
        //     "hiddenAttributes": [{"name": "entryPoint", "value": "HealthcareAPI"}, {
        //         "name": "id",
        //         "value": "HealthcareAPI@9:Resource"
        //     }],
        //     "modifiedId": "HealthcareAPI@9:Resource"
        // }, {
        //     "id": "HealthcareAPI@10:API_INSEQ",
        //     "label": "API_INSEQ",
        //     "parents": [],
        //     "group": "HealthcareAPI@9:Resource",
        //     "type": "group",
        //     "dataAttributes": [{"name": "Invocations", "value": 2}, {
        //         "name": "AvgDuration",
        //         "value": "570.00"
        //     }, {"name": "MaxDuration", "value": 1044}, {"name": "Faults", "value": 0}],
        //     "hiddenAttributes": [{"name": "entryPoint", "value": "HealthcareAPI"}, {
        //         "name": "id",
        //         "value": "API_INSEQ"
        //     }],
        //     "modifiedId": "HealthcareAPI@10:API_INSEQ"
        // }, {
        //     "id": "HealthcareAPI@11:PropertyMediator:Hospital",
        //     "label": "PropertyMediator:Hospital",
        //     "parents": [],
        //     "group": "HealthcareAPI@10:API_INSEQ",
        //     "type": "Mediator",
        //     "dataAttributes": [{"name": "Invocations", "value": 2}, {
        //         "name": "AvgDuration",
        //         "value": "7.00"
        //     }, {"name": "MaxDuration", "value": 13}, {"name": "Faults", "value": 0}],
        //     "hiddenAttributes": [{"name": "entryPoint", "value": "HealthcareAPI"}, {
        //         "name": "id",
        //         "value": "HealthcareAPI@11:PropertyMediator:Hospital"
        //     }],
        //     "modifiedId": "HealthcareAPI@11:PropertyMediator:Hospital"
        // }, {
        //     "id": "HealthcareAPI@12:PropertyMediator:card_number",
        //     "label": "PropertyMediator:card_number",
        //     "parents": ["HealthcareAPI@11:PropertyMediator:Hospital"],
        //     "group": "HealthcareAPI@10:API_INSEQ",
        //     "type": "Mediator",
        //     "dataAttributes": [{"name": "Invocations", "value": 2}, {
        //         "name": "AvgDuration",
        //         "value": "0.00"
        //     }, {"name": "MaxDuration", "value": 5e-324}, {"name": "Faults", "value": 0}],
        //     "hiddenAttributes": [{"name": "entryPoint", "value": "HealthcareAPI"}, {
        //         "name": "id",
        //         "value": "HealthcareAPI@12:PropertyMediator:card_number"
        //     }],
        //     "modifiedId": "HealthcareAPI@12:PropertyMediator:card_number"
        // }, {
        //     "id": "HealthcareAPI@13:DataMapperMediator",
        //     "label": "DataMapperMediator",
        //     "parents": ["HealthcareAPI@12:PropertyMediator:card_number"],
        //     "group": "HealthcareAPI@10:API_INSEQ",
        //     "type": "Mediator",
        //     "dataAttributes": [{"name": "Invocations", "value": 2}, {
        //         "name": "AvgDuration",
        //         "value": "444.00"
        //     }, {"name": "MaxDuration", "value": 851}, {"name": "Faults", "value": 0}],
        //     "hiddenAttributes": [{"name": "entryPoint", "value": "HealthcareAPI"}, {
        //         "name": "id",
        //         "value": "HealthcareAPI@13:DataMapperMediator"
        //     }],
        //     "modifiedId": "HealthcareAPI@13:DataMapperMediator"
        // }, {
        //     "id": "HealthcareAPI@14:SwitchMediator",
        //     "label": "SwitchMediator",
        //     "parents": ["HealthcareAPI@13:DataMapperMediator"],
        //     "group": "HealthcareAPI@10:API_INSEQ",
        //     "type": "group",
        //     "dataAttributes": [{"name": "Invocations", "value": 2}, {
        //         "name": "AvgDuration",
        //         "value": "137.00"
        //     }, {"name": "MaxDuration", "value": 212}, {"name": "Faults", "value": 0}],
        //     "hiddenAttributes": [{"name": "entryPoint", "value": "HealthcareAPI"}, {
        //         "name": "id",
        //         "value": "HealthcareAPI@14:SwitchMediator"
        //     }],
        //     "modifiedId": "HealthcareAPI@14:SwitchMediator"
        // }, {
        //     "id": "HealthcareAPI@15:LogMediator",
        //     "label": "LogMediator",
        //     "parents": [],
        //     "group": "HealthcareAPI@14:SwitchMediator",
        //     "type": "Mediator",
        //     "dataAttributes": [{"name": "Invocations", "value": 2}, {
        //         "name": "AvgDuration",
        //         "value": "1.50"
        //     }, {"name": "MaxDuration", "value": 2}, {"name": "Faults", "value": 0}],
        //     "hiddenAttributes": [{"name": "entryPoint", "value": "HealthcareAPI"}, {
        //         "name": "id",
        //         "value": "HealthcareAPI@15:LogMediator"
        //     }],
        //     "modifiedId": "HealthcareAPI@15:LogMediator"
        // }, {
        //     "id": "HealthcareAPI@16:PropertyMediator:uri.var.hospital",
        //     "label": "PropertyMediator:uri.var.hospital",
        //     "parents": ["HealthcareAPI@15:LogMediator"],
        //     "group": "HealthcareAPI@14:SwitchMediator",
        //     "type": "Mediator",
        //     "dataAttributes": [{"name": "Invocations", "value": 2}, {
        //         "name": "AvgDuration",
        //         "value": "17.00"
        //     }, {"name": "MaxDuration", "value": 32}, {"name": "Faults", "value": 0}],
        //     "hiddenAttributes": [{"name": "entryPoint", "value": "HealthcareAPI"}, {
        //         "name": "id",
        //         "value": "HealthcareAPI@16:PropertyMediator:uri.var.hospital"
        //     }],
        //     "modifiedId": "HealthcareAPI@16:PropertyMediator:uri.var.hospital"
        // }, {
        //     "id": "HealthcareAPI@17:CallMediator",
        //     "label": "CallMediator",
        //     "parents": ["HealthcareAPI@16:PropertyMediator:uri.var.hospital"],
        //     "group": "HealthcareAPI@14:SwitchMediator",
        //     "type": "group",
        //     "dataAttributes": [{"name": "Invocations", "value": 2}, {
        //         "name": "AvgDuration",
        //         "value": "66.00"
        //     }, {"name": "MaxDuration", "value": 115}, {"name": "Faults", "value": 0}],
        //     "hiddenAttributes": [{"name": "entryPoint", "value": "HealthcareAPI"}, {
        //         "name": "id",
        //         "value": "HealthcareAPI@17:CallMediator"
        //     }],
        //     "modifiedId": "HealthcareAPI@17:CallMediator"
        // }, {
        //     "id": "GrandOakEP@18:GrandOakEP@indirect",
        //     "label": "GrandOakEP",
        //     "parents": [],
        //     "group": "HealthcareAPI@17:CallMediator",
        //     "type": "Endpoint",
        //     "dataAttributes": [{"name": "Invocations", "value": 2}, {
        //         "name": "AvgDuration",
        //         "value": "72.50"
        //     }, {"name": "MaxDuration", "value": 127}, {"name": "Faults", "value": 0}],
        //     "hiddenAttributes": [{"name": "entryPoint", "value": "HealthcareAPI"}, {
        //         "name": "id",
        //         "value": "GrandOakEP"
        //     }],
        //     "modifiedId": "GrandOakEP@0:GrandOakEP"
        // }, {
        //     "id": "HealthcareAPI@19:LogMediator",
        //     "label": "LogMediator",
        //     "parents": [],
        //     "group": "HealthcareAPI@14:SwitchMediator",
        //     "type": "UNKNOWN",
        //     "dataAttributes": [{"name": "Invocations", "value": 0}, {
        //         "name": "TotalDuration",
        //         "value": 0
        //     }, {"name": "MaxDuration", "value": 0}, {"name": "Faults", "value": 0}],
        //     "hiddenAttributes": [{"name": "entryPoint", "value": "HealthcareAPI"}, {
        //         "name": "id",
        //         "value": "HealthcareAPI@19:LogMediator"
        //     }],
        //     "modifiedId": "HealthcareAPI@19:LogMediator"
        // }, {
        //     "id": "HealthcareAPI@20:PropertyMediator:uri.var.hospital",
        //     "label": "PropertyMediator:uri.var.hospital",
        //     "parents": ["HealthcareAPI@19:LogMediator"],
        //     "group": "HealthcareAPI@14:SwitchMediator",
        //     "type": "UNKNOWN",
        //     "dataAttributes": [{"name": "Invocations", "value": 0}, {
        //         "name": "TotalDuration",
        //         "value": 0
        //     }, {"name": "MaxDuration", "value": 0}, {"name": "Faults", "value": 0}],
        //     "hiddenAttributes": [{"name": "entryPoint", "value": "HealthcareAPI"}, {
        //         "name": "id",
        //         "value": "HealthcareAPI@20:PropertyMediator:uri.var.hospital"
        //     }],
        //     "modifiedId": "HealthcareAPI@20:PropertyMediator:uri.var.hospital"
        // }, {
        //     "id": "HealthcareAPI@21:CallMediator",
        //     "label": "CallMediator",
        //     "parents": ["HealthcareAPI@20:PropertyMediator:uri.var.hospital"],
        //     "group": "HealthcareAPI@14:SwitchMediator",
        //     "type": "group",
        //     "dataAttributes": [{"name": "Invocations", "value": 0}, {
        //         "name": "TotalDuration",
        //         "value": 0
        //     }, {"name": "MaxDuration", "value": 0}, {"name": "Faults", "value": 0}],
        //     "hiddenAttributes": [{"name": "entryPoint", "value": "HealthcareAPI"}, {
        //         "name": "id",
        //         "value": "HealthcareAPI@21:CallMediator"
        //     }],
        //     "modifiedId": "HealthcareAPI@21:CallMediator"
        // }, {
        //     "id": "ClemencyEP@22:ClemencyEP@indirect",
        //     "label": "ClemencyEP",
        //     "parents": [],
        //     "group": "HealthcareAPI@21:CallMediator",
        //     "type": "UNKNOWN",
        //     "dataAttributes": [{"name": "Invocations", "value": 0}, {
        //         "name": "TotalDuration",
        //         "value": 0
        //     }, {"name": "MaxDuration", "value": 0}, {"name": "Faults", "value": 0}],
        //     "hiddenAttributes": [{"name": "entryPoint", "value": "HealthcareAPI"}, {
        //         "name": "id",
        //         "value": "ClemencyEP@0:ClemencyEP"
        //     }],
        //     "modifiedId": "ClemencyEP@0:ClemencyEP"
        // }, {
        //     "id": "HealthcareAPI@23:LogMediator",
        //     "label": "LogMediator",
        //     "parents": [],
        //     "group": "HealthcareAPI@14:SwitchMediator",
        //     "type": "UNKNOWN",
        //     "dataAttributes": [{"name": "Invocations", "value": 0}, {
        //         "name": "TotalDuration",
        //         "value": 0
        //     }, {"name": "MaxDuration", "value": 0}, {"name": "Faults", "value": 0}],
        //     "hiddenAttributes": [{"name": "entryPoint", "value": "HealthcareAPI"}, {
        //         "name": "id",
        //         "value": "HealthcareAPI@23:LogMediator"
        //     }],
        //     "modifiedId": "HealthcareAPI@23:LogMediator"
        // }, {
        //     "id": "HealthcareAPI@24:PropertyMediator:uri.var.hospital",
        //     "label": "PropertyMediator:uri.var.hospital",
        //     "parents": ["HealthcareAPI@23:LogMediator"],
        //     "group": "HealthcareAPI@14:SwitchMediator",
        //     "type": "UNKNOWN",
        //     "dataAttributes": [{"name": "Invocations", "value": 0}, {
        //         "name": "TotalDuration",
        //         "value": 0
        //     }, {"name": "MaxDuration", "value": 0}, {"name": "Faults", "value": 0}],
        //     "hiddenAttributes": [{"name": "entryPoint", "value": "HealthcareAPI"}, {
        //         "name": "id",
        //         "value": "HealthcareAPI@24:PropertyMediator:uri.var.hospital"
        //     }],
        //     "modifiedId": "HealthcareAPI@24:PropertyMediator:uri.var.hospital"
        // }, {
        //     "id": "HealthcareAPI@25:CallMediator",
        //     "label": "CallMediator",
        //     "parents": ["HealthcareAPI@24:PropertyMediator:uri.var.hospital"],
        //     "group": "HealthcareAPI@14:SwitchMediator",
        //     "type": "group",
        //     "dataAttributes": [{"name": "Invocations", "value": 0}, {
        //         "name": "TotalDuration",
        //         "value": 0
        //     }, {"name": "MaxDuration", "value": 0}, {"name": "Faults", "value": 0}],
        //     "hiddenAttributes": [{"name": "entryPoint", "value": "HealthcareAPI"}, {
        //         "name": "id",
        //         "value": "HealthcareAPI@25:CallMediator"
        //     }],
        //     "modifiedId": "HealthcareAPI@25:CallMediator"
        // }, {
        //     "id": "PineValleyEP@26:PineValleyEP@indirect",
        //     "label": "PineValleyEP",
        //     "parents": [],
        //     "group": "HealthcareAPI@25:CallMediator",
        //     "type": "UNKNOWN",
        //     "dataAttributes": [{"name": "Invocations", "value": 0}, {
        //         "name": "TotalDuration",
        //         "value": 0
        //     }, {"name": "MaxDuration", "value": 0}, {"name": "Faults", "value": 0}],
        //     "hiddenAttributes": [{"name": "entryPoint", "value": "HealthcareAPI"}, {
        //         "name": "id",
        //         "value": "PineValleyEP@0:PineValleyEP"
        //     }],
        //     "modifiedId": "PineValleyEP@0:PineValleyEP"
        // }, {
        //     "id": "HealthcareAPI@27:PropertyMediator:uri.var.appointment_id",
        //     "label": "PropertyMediator:uri.var.appointment_id",
        //     "parents": ["HealthcareAPI@14:SwitchMediator"],
        //     "group": "HealthcareAPI@10:API_INSEQ",
        //     "type": "Mediator",
        //     "dataAttributes": [{"name": "Invocations", "value": 2}, {
        //         "name": "AvgDuration",
        //         "value": "11.00"
        //     }, {"name": "MaxDuration", "value": 19}, {"name": "Faults", "value": 0}],
        //     "hiddenAttributes": [{"name": "entryPoint", "value": "HealthcareAPI"}, {
        //         "name": "id",
        //         "value": "HealthcareAPI@27:PropertyMediator:uri.var.appointment_id"
        //     }],
        //     "modifiedId": "HealthcareAPI@27:PropertyMediator:uri.var.appointment_id"
        // }, {
        //     "id": "HealthcareAPI@28:PropertyMediator:doctor_details",
        //     "label": "PropertyMediator:doctor_details",
        //     "parents": ["HealthcareAPI@27:PropertyMediator:uri.var.appointment_id"],
        //     "group": "HealthcareAPI@10:API_INSEQ",
        //     "type": "Mediator",
        //     "dataAttributes": [{"name": "Invocations", "value": 2}, {
        //         "name": "AvgDuration",
        //         "value": "4.00"
        //     }, {"name": "MaxDuration", "value": 6}, {"name": "Faults", "value": 0}],
        //     "hiddenAttributes": [{"name": "entryPoint", "value": "HealthcareAPI"}, {
        //         "name": "id",
        //         "value": "HealthcareAPI@28:PropertyMediator:doctor_details"
        //     }],
        //     "modifiedId": "HealthcareAPI@28:PropertyMediator:doctor_details"
        // }, {
        //     "id": "HealthcareAPI@29:PropertyMediator:patient_details",
        //     "label": "PropertyMediator:patient_details",
        //     "parents": ["HealthcareAPI@28:PropertyMediator:doctor_details"],
        //     "group": "HealthcareAPI@10:API_INSEQ",
        //     "type": "Mediator",
        //     "dataAttributes": [{"name": "Invocations", "value": 2}, {
        //         "name": "AvgDuration",
        //         "value": "7.50"
        //     }, {"name": "MaxDuration", "value": 13}, {"name": "Faults", "value": 0}],
        //     "hiddenAttributes": [{"name": "entryPoint", "value": "HealthcareAPI"}, {
        //         "name": "id",
        //         "value": "HealthcareAPI@29:PropertyMediator:patient_details"
        //     }],
        //     "modifiedId": "HealthcareAPI@29:PropertyMediator:patient_details"
        // }, {
        //     "id": "HealthcareAPI@30:CallMediator",
        //     "label": "CallMediator",
        //     "parents": ["HealthcareAPI@29:PropertyMediator:patient_details"],
        //     "group": "HealthcareAPI@10:API_INSEQ",
        //     "type": "group",
        //     "dataAttributes": [{"name": "Invocations", "value": 2}, {
        //         "name": "AvgDuration",
        //         "value": "6.50"
        //     }, {"name": "MaxDuration", "value": 12}, {"name": "Faults", "value": 0}],
        //     "hiddenAttributes": [{"name": "entryPoint", "value": "HealthcareAPI"}, {
        //         "name": "id",
        //         "value": "HealthcareAPI@30:CallMediator"
        //     }],
        //     "modifiedId": "HealthcareAPI@30:CallMediator"
        // }, {
        //     "id": "ChannelingFeeEP@31:ChannelingFeeEP@indirect",
        //     "label": "ChannelingFeeEP",
        //     "parents": [],
        //     "group": "HealthcareAPI@30:CallMediator",
        //     "type": "Endpoint",
        //     "dataAttributes": [{"name": "Invocations", "value": 2}, {
        //         "name": "AvgDuration",
        //         "value": "10.00"
        //     }, {"name": "MaxDuration", "value": 12}, {"name": "Faults", "value": 0}],
        //     "hiddenAttributes": [{"name": "entryPoint", "value": "HealthcareAPI"}, {
        //         "name": "id",
        //         "value": "ChannelingFeeEP"
        //     }],
        //     "modifiedId": "ChannelingFeeEP@0:ChannelingFeeEP"
        // }, {
        //     "id": "HealthcareAPI@32:PropertyMediator:actual_fee",
        //     "label": "PropertyMediator:actual_fee",
        //     "parents": ["HealthcareAPI@30:CallMediator"],
        //     "group": "HealthcareAPI@10:API_INSEQ",
        //     "type": "Mediator",
        //     "dataAttributes": [{"name": "Invocations", "value": 2}, {
        //         "name": "AvgDuration",
        //         "value": "1.00"
        //     }, {"name": "MaxDuration", "value": 1}, {"name": "Faults", "value": 0}],
        //     "hiddenAttributes": [{"name": "entryPoint", "value": "HealthcareAPI"}, {
        //         "name": "id",
        //         "value": "HealthcareAPI@32:PropertyMediator:actual_fee"
        //     }],
        //     "modifiedId": "HealthcareAPI@32:PropertyMediator:actual_fee"
        // }, {
        //     "id": "HealthcareAPI@33:PayloadFactoryMediator",
        //     "label": "PayloadFactoryMediator",
        //     "parents": ["HealthcareAPI@32:PropertyMediator:actual_fee"],
        //     "group": "HealthcareAPI@10:API_INSEQ",
        //     "type": "Mediator",
        //     "dataAttributes": [{"name": "Invocations", "value": 2}, {
        //         "name": "AvgDuration",
        //         "value": "4.00"
        //     }, {"name": "MaxDuration", "value": 6}, {"name": "Faults", "value": 0}],
        //     "hiddenAttributes": [{"name": "entryPoint", "value": "HealthcareAPI"}, {
        //         "name": "id",
        //         "value": "HealthcareAPI@33:PayloadFactoryMediator"
        //     }],
        //     "modifiedId": "HealthcareAPI@33:PayloadFactoryMediator"
        // }, {
        //     "id": "HealthcareAPI@34:CallMediator",
        //     "label": "CallMediator",
        //     "parents": ["HealthcareAPI@33:PayloadFactoryMediator"],
        //     "group": "HealthcareAPI@10:API_INSEQ",
        //     "type": "group",
        //     "dataAttributes": [{"name": "Invocations", "value": 2}, {
        //         "name": "AvgDuration",
        //         "value": "2.00"
        //     }, {"name": "MaxDuration", "value": 2}, {"name": "Faults", "value": 0}],
        //     "hiddenAttributes": [{"name": "entryPoint", "value": "HealthcareAPI"}, {
        //         "name": "id",
        //         "value": "HealthcareAPI@34:CallMediator"
        //     }],
        //     "modifiedId": "HealthcareAPI@34:CallMediator"
        // }, {
        //     "id": "SettlePaymentEP@35:SettlePaymentEP@indirect",
        //     "label": "SettlePaymentEP",
        //     "parents": [],
        //     "group": "HealthcareAPI@34:CallMediator",
        //     "type": "Endpoint",
        //     "dataAttributes": [{"name": "Invocations", "value": 2}, {
        //         "name": "AvgDuration",
        //         "value": "10.00"
        //     }, {"name": "MaxDuration", "value": 12}, {"name": "Faults", "value": 0}],
        //     "hiddenAttributes": [{"name": "entryPoint", "value": "HealthcareAPI"}, {
        //         "name": "id",
        //         "value": "SettlePaymentEP"
        //     }],
        //     "modifiedId": "SettlePaymentEP@0:SettlePaymentEP"
        // }, {
        //     "id": "HealthcareAPI@36:RespondMediator",
        //     "label": "RespondMediator",
        //     "parents": ["HealthcareAPI@34:CallMediator"],
        //     "group": "HealthcareAPI@10:API_INSEQ",
        //     "type": "Mediator",
        //     "dataAttributes": [{"name": "Invocations", "value": 2}, {
        //         "name": "AvgDuration",
        //         "value": "5.50"
        //     }, {"name": "MaxDuration", "value": 10}, {"name": "Faults", "value": 0}],
        //     "hiddenAttributes": [{"name": "entryPoint", "value": "HealthcareAPI"}, {
        //         "name": "id",
        //         "value": "HealthcareAPI@36:RespondMediator"
        //     }],
        //     "modifiedId": "HealthcareAPI@36:RespondMediator"
        // }, {
        //     "id": "HealthcareAPI@37:API_OUTSEQ",
        //     "label": "API_OUTSEQ",
        //     "parents": ["HealthcareAPI@10:API_INSEQ"],
        //     "group": "HealthcareAPI@9:Resource",
        //     "type": "group",
        //     "dataAttributes": [{"name": "Invocations", "value": 0}, {
        //         "name": "TotalDuration",
        //         "value": 0
        //     }, {"name": "MaxDuration", "value": 0}, {"name": "Faults", "value": 0}],
        //     "hiddenAttributes": [{"name": "entryPoint", "value": "HealthcareAPI"}, {
        //         "name": "id",
        //         "value": "HealthcareAPI@37:API_OUTSEQ"
        //     }],
        //     "modifiedId": "HealthcareAPI@37:API_OUTSEQ"
        // }, {
        //     "id": "HealthcareAPI@38:SendMediator",
        //     "label": "SendMediator",
        //     "parents": [],
        //     "group": "HealthcareAPI@37:API_OUTSEQ",
        //     "type": "UNKNOWN",
        //     "dataAttributes": [{"name": "Invocations", "value": 0}, {
        //         "name": "TotalDuration",
        //         "value": 0
        //     }, {"name": "MaxDuration", "value": 0}, {"name": "Faults", "value": 0}],
        //     "hiddenAttributes": [{"name": "entryPoint", "value": "HealthcareAPI"}, {
        //         "name": "id",
        //         "value": "HealthcareAPI@38:SendMediator"
        //     }],
        //     "modifiedId": "HealthcareAPI@38:SendMediator"
        // }, {
        //     "id": "HealthcareAPI@39:API_FAULTSEQ",
        //     "label": "API_FAULTSEQ",
        //     "parents": ["HealthcareAPI@37:API_OUTSEQ"],
        //     "group": "HealthcareAPI@9:Resource",
        //     "type": "UNKNOWN",
        //     "dataAttributes": [{"name": "Invocations", "value": 0}, {
        //         "name": "TotalDuration",
        //         "value": 0
        //     }, {"name": "MaxDuration", "value": 0}, {"name": "Faults", "value": 0}],
        //     "hiddenAttributes": [{"name": "entryPoint", "value": "HealthcareAPI"}, {
        //         "name": "id",
        //         "value": "HealthcareAPI@39:API_FAULTSEQ"
        //     }],
        //     "modifiedId": "HealthcareAPI@39:API_FAULTSEQ"
        // }];
        //
        // // Draw the message flow with the received data
        // this.drawMessageFlow($, data);

        // Extract message flow data from the data store for PROXY and API
        // this.extractEntryPointMessageFlowData(
        //     this.parameters.timeFrom,
        //     this.parameters.timeTo,
        //     this.parameters.timeUnit,
        //     this.parameters.entryName,
        //     this.parameters.meta_tenantId
        // );
    }

    noParameters() {
        var page = this.getCurrentPage();
        switch (page.name) {
            case 'api':
                return 'Please select an API and a valid date range to view stats.';
                break;
            case 'proxy':
                return 'Please select a Proxy Service and a valid date range to view stats.';
                break;
            case 'sequences':
                return 'Please select a Sequence and a valid date range to view stats.';
                break;
            case 'endpoint':
                return 'Please select an Endpoint and a valid date range to view stats.';
                break;
            case 'inboundEndpoint':
                return 'Please select an Inbound Endpoint and a valid date range to view stats.';
                break;
            default:
                return 'Please select a valid date range to view stats';
        }
        ;
    }

    getCurrentPage() {
        var page, pageName;
        var href = parent.window.location.href;
        var lastSegment = href.substr(href.lastIndexOf('/') + 1);
        if (lastSegment.indexOf('?') === -1) {
            pageName = lastSegment;
        } else {
            pageName = lastSegment.substr(0, lastSegment.indexOf('?'));
        }
        return getGadgetConfig(pageName);
    };

    render() {
        return (
            <body>
            <div className="nano" ref={this.domElementNano}>
                <div className="nano-content">
                    <div className="page-content-wrapper">
                        <div className="zoom-panel">
                            <button className="btn-zoom" id="btnZoomIn" ref={this.domElementBtnZoomIn}>+</button>
                            <br/>
                            <button className="btn-zoom" id="btnZoomOut" ref={this.domElementBtnZoomOut}>-</button>
                            <br/>
                            <button className="btn-zoom" id="btnZoomFit" ref={this.domElementBtnZoomFit}>
                                <i className="fw fw-square-outline"></i>
                            </button>
                        </div>
                        <div id="canvas" ref={this.domElementCanvas}>
                            {this.state.dataUnavailable === true ?
                                <div class="status-message">
                                    <div class="message message-info">
                                        <h4 style={centerDiv}>
                                            <i class="icon fw fw-info"></i> No records found</h4>
                                        <p style={centerDiv}>{this.noParameters()}</p>
                                    </div>
                                </div> : null}
                        </div>
                        <svg id="svg-canvas" width="100%" height="100%" ref={this.domElementSvg}></svg>
                    </div>
                </div>
            </div>
            </body>
        );
    }
}

function getDashboardBaseUrl() {
    var currentUrl = window.parent.location.href;
    var BaseUrlRegex = new RegExp(".*?(portal.*dashboards)");
    var tenantBaseUrl = BaseUrlRegex.exec(currentUrl)[1];
    return "/" + tenantBaseUrl + "/" + DASHBOARD_NAME + "/";
}

function getGadgetConfig(typeName) {
    var config = null;
    configs.forEach(function (item, i) {
        if (item.name === typeName) {
            config = item;
        }
    });
    return config;
};

global.dashboard.registerWidget('MessageFlow', MessageFlow);