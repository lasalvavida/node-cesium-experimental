'use strict';

var CesiumCore = require('cesium-core-experimental');
var BoundingRectangle = CesiumCore.BoundingRectangle;
var Color = CesiumCore.Color;
var defined = CesiumCore.defined;
var destroyObject = CesiumCore.destroyObject;
var DeveloperError = CesiumCore.DeveloperError;
var PrimitiveType = CesiumCore.PrimitiveType;
var ViewportQuadVS = require('../Shaders/ViewportQuadVS');
var ClearCommand = require('./ClearCommand');
var DrawCommand = require('./DrawCommand');
var Framebuffer = require('./Framebuffer');
var RenderState = require('./RenderState');
var ShaderProgram = require('./ShaderProgram');

/**
 * @private
 */
function ComputeEngine(context) {
    this._context = context;
}

var renderStateScratch;
var drawCommandScratch = new DrawCommand({
    primitiveType : PrimitiveType.TRIANGLES
});
var clearCommandScratch = new ClearCommand({
    color : new Color(0.0, 0.0, 0.0, 0.0)
});

function createFramebuffer(context, outputTexture) {
    return new Framebuffer({
        context : context,
        colorTextures : [outputTexture],
        destroyAttachments : false
    });
}

function createViewportQuadShader(context, fragmentShaderSource) {
    return ShaderProgram.fromCache({
        context : context,
        vertexShaderSource : ViewportQuadVS,
        fragmentShaderSource : fragmentShaderSource,
        attributeLocations : {
            position : 0,
            textureCoordinates : 1
        }
    });
}

function createRenderState(width, height) {
    if ((!defined(renderStateScratch)) ||
        (renderStateScratch.viewport.width !== width) ||
        (renderStateScratch.viewport.height !== height)) {

        renderStateScratch = RenderState.fromCache({
            viewport : new BoundingRectangle(0, 0, width, height)
        });
    }
    return renderStateScratch;
}

ComputeEngine.prototype.execute = function(computeCommand) {
    //>>includeStart('debug', pragmas.debug);
    if (!defined(computeCommand)) {
        throw new DeveloperError('computeCommand is required.');
    }
    //>>includeEnd('debug');

    // This may modify the command's resources, so do error checking afterwards
    if (defined(computeCommand.preExecute)) {
        computeCommand.preExecute(computeCommand);
    }

    //>>includeStart('debug', pragmas.debug);
    if (!defined(computeCommand.fragmentShaderSource) && !defined(computeCommand.shaderProgram)) {
        throw new DeveloperError('computeCommand.fragmentShaderSource or computeCommand.shaderProgram is required.');
    }

    if (!defined(computeCommand.outputTexture)) {
        throw new DeveloperError('computeCommand.outputTexture is required.');
    }
    //>>includeEnd('debug');

    var outputTexture = computeCommand.outputTexture;
    var width = outputTexture.width;
    var height = outputTexture.height;

    var context = this._context;
    var vertexArray = defined(computeCommand.vertexArray) ? computeCommand.vertexArray : context.getViewportQuadVertexArray();
    var shaderProgram = defined(computeCommand.shaderProgram) ? computeCommand.shaderProgram : createViewportQuadShader(context, computeCommand.fragmentShaderSource);
    var framebuffer = createFramebuffer(context, outputTexture);
    var renderState = createRenderState(width, height);
    var uniformMap = computeCommand.uniformMap;

    var clearCommand = clearCommandScratch;
    clearCommand.framebuffer = framebuffer;
    clearCommand.renderState = renderState;
    clearCommand.execute(context);

    var drawCommand = drawCommandScratch;
    drawCommand.vertexArray = vertexArray;
    drawCommand.renderState = renderState;
    drawCommand.shaderProgram = shaderProgram;
    drawCommand.uniformMap = uniformMap;
    drawCommand.framebuffer = framebuffer;
    drawCommand.execute(context);

    framebuffer.destroy();

    if (!computeCommand.persists) {
        shaderProgram.destroy();
        if (defined(computeCommand.vertexArray)) {
            vertexArray.destroy();
        }
    }

    if (defined(computeCommand.postExecute)) {
        computeCommand.postExecute(outputTexture);
    }
};

ComputeEngine.prototype.isDestroyed = function() {
    return false;
};

ComputeEngine.prototype.destroy = function() {
    return destroyObject(this);
};

module.exports = ComputeEngine;

