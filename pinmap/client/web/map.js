//Author: Pindrought
window.onload = OnLoad;
//The "legendKeys" array stores all of the keys that appear on the legend. Each key element also stores an array of "blips" that can appear on the map if the legend key is enabled.
var legendKeys = []; //Legend keys
//Map width/height is required in order for the scaling to be properly applied.
var mapWidth = 2000;
var mapHeight = 1943;
//Mouse x,y are stored for things like scrolling to scroll towards/out from a certain position
var mousePosX = 0;
var mousePosY = 0;
//Initial mouse x & y when dragging to calculate dx and dy
var mouseStartDragX = 0;
var mouseStartDragY = 0;
//Map div beginning x & y when dragging
var mapDivStartDragX = 0;
var mapDivStartDragY = 0;
var mapDivX = -40;
var mapDivY = -431;
var mapScale = 1;
//Window Width & Height are used by the FixMapLocation() function to ensure that the map does not get dragged off the screen boundaries.
var windowWidth = 0;
var windowHeight = 0;
//runningFromBrowser will be determined OnLoad and special logic can be called for debugging via browser
var runningFromBrowser = true;

function OnLoad()
{
    if (typeof ue !== 'undefined') //Determine if we're running from browser. If this is not undefined, we are running from game.
    {
        runningFromBrowser = false;
    }

    window.addEventListener('mousedown', MouseDown, false); //mousedown to start drag and close context menu if not clicking on it
    window.addEventListener('mouseup', MouseUp); //mouseup to stop drag
    window.addEventListener('keydown', KeyDown); //keydown to close map with callback when 'M' is pressed
    window.addEventListener('wheel', MouseScroll); //mouse wheel event for scrolling
    window.addEventListener('mousemove', UpdateMousePos, true); //Update mouse pos to be able to retrieve mouse pos when scrolling in&out
    window.addEventListener('contextmenu', ActivateCustomContextMenu); //Custom right click menu for setting destination/teleport

    RefreshMap(mapScale); //Adjust/position the map accordingly.

    if (runningFromBrowser) //Setup stuff that game would normally set up for testing in browser
    {
        AssignParameters(window.innerWidth, window.innerHeight);
        RegisterLegendKey('market', 'Market', 'market.png');
        RegisterBlip('market', 129000, 78521);

        RegisterLegendKey('gunstore', 'Gun Store', 'gunstore.png');
        RegisterBlip('gunstore', 101527, -34633);
        RegisterBlip('gunstore', 135200, 192240);
        EnableDevMode();
    }
    
    CallEvent('OnMapUILoaded', null); //Call event to main.lua so that it knows that the web ui is loaded. The main.lua needs to know before attempting to send data like legend data, because it is invalid behavior to ExecuteJS before the web ui is loaded.
}

function MouseDown(e)
{
    if (e.button == 2) //If right click, exit since right click is just used for context menu
    {
        return;
    }
    if (e.button == 1) //middle mouse click
    {
        e.preventDefault(); //We prevent default for middle mouse click so user can drag around even when zoomed in. It messes up when the drag icon appears from middle mouse click.
    }
    var menu = document.getElementById("menu");
    if (menu.style.display == "block") //If our custom right click menu is currently visible, check if the mouse click was inside of it...
    {
        var leftX = parseInt(menu.style.left);
        var rightX = leftX + menu.offsetWidth;
        var topY = parseInt(menu.style.top);
        var bottomY = topY + menu.offsetHeight;
        if (e.clientX >= leftX &&
            e.clientX <= rightX &&
            e.clientY >= topY &&
            e.clientY <= bottomY) //If the mouse click was within the menu boundaries...
        {
            return; //Exit function early since this could possibly be the user clicking a menu option and we don't want to close the menu before that onclick event is called.
        }
        menu.style.display = "none"; //Hide the menu if we are not clicking on a menu option.
    }
    //Store the initial mouse x & y position when dragging for calculating dx and dy
    mouseStartDragX = e.clientX;
    mouseStartDragY = e.clientY;
    //Store the initial map x & y position when dragging for calculating dx and dy
    var mapdiv = document.getElementById('mapdiv');
    mapDivStartDragX = parseInt(mapdiv.style.left, 10);
    mapDivStartDragY = parseInt(mapdiv.style.top, 10);
    window.addEventListener('mousemove', MapDrag, true); //Add event listener for moving mouse to update map position while dragging
}

function MouseUp() //When user stops dragging, remove the dragging listener that was causing map to move
{
    window.removeEventListener('mousemove', MapDrag, true);
}

function MapDrag(e) //This event is a mousemove event only active when the mouse is being held and the user is attempting to drag the map
{
    var mapdiv = document.getElementById('mapdiv');
    mapdiv.style.position = 'absolute';
    dx = e.clientX - mouseStartDragX;
    dy = e.clientY - mouseStartDragY;
    mapDivX = mapDivStartDragX+dx;
    mapDivY = mapDivStartDragY+dy;
    FixMapLocation(); //Fix map location to make sure user does not drag map off screen
    mapdiv.style.left = (mapDivX) + 'px';
    mapdiv.style.top = (mapDivY) + 'px';
}

function KeyDown(e) 
{
    var keyCode = e.keyCode; //Get code of key pressed
    if (keyCode==77) //77 = M - If the user presses M, we can Call an event to main.lua to close the map since the input will not be received by main.lua while ui is focused.
    {
        CallEvent('CloseMap', null);
    }
}

function MouseScroll(e)
{
    const delta = Math.sign(e.deltaY); //Get the sign of deltaY to determine if we are zooming in or out
    var prevMapScale = mapScale; //Store previous map scale so this can be passed to RefreshMap() - This is used to calculate the new factor for adjusting the map after zoom
    if (delta == -1) //zooming in
    {
        if (mapScale < 3.0)
        {
            mapScale = mapScale / 0.8;
        }
    }
    else //zooming out
    {
        if (mapScale > 0.3)
        {
            mapScale = mapScale * 0.8;
        }
    }
    RefreshMap(prevMapScale); //Refresh the map to resize/zoom/recalculate blip & marker positions on mapdiv
}

function UpdateMousePos(e)
{
    mousePosX = e.clientX;
    mousePosY = e.clientY;
}

function ActivateCustomContextMenu(e) //Custom right click to allow assigning destinations
{
    e.preventDefault(); //Prevent the default behavior so we don't see standard html right click menu popup
    var menu = document.getElementById("menu");
    menu.style.display = "block"; //Set menu to visible
    menu.style.left = e.pageX + 'px'; //Adjust topleft x coordinate of menu to mouse pos
    menu.style.top = e.pageY + 'px'; //Adjust topleft y coordinate of menu to mouse pos
}

function MenuOptionClicked(option) //This is called when one of the right click menu options are clicked.
{
    var menu = document.getElementById("menu");
    menu.style.display = "none"; //Hide menu when option is clicked
    var menuX = parseInt(menu.style.left) //Original right click X position from when menu was created
    var menuY = parseInt(menu.style.top) //Original right click X position from when menu was created

    var destinationMarker = document.getElementById("destinationmarker");

    if (option == "SetDestination")
    {
        destinationMarker.worldX = MapHelper.UIPixelToWorldX(menuX) //Store world X for destination marker - this is used when recalculating mapdiv position due to scrolling in/out
        destinationMarker.worldY = MapHelper.UIPixelToWorldY(menuY) //Store world Y for destination marker - this is used when recalculating mapdiv position due to scrolling in/out
        destinationMarker.style.left = (MapHelper.UIPixelToMapDivX(menuX) - 16) + 'px'; //Center destination marker icon on the x position
        destinationMarker.style.top = (MapHelper.UIPixelToMapDivY(menuY) - 32) + 'px'; //Adjust the y so that the destination marker icon bottom is pointing to the position
        destinationMarker.style.display = "block"; //Show destination marker
        CallEvent("UpdateMapDestination", destinationMarker.worldX, destinationMarker.worldY) //Send destination marker x,y coords to main.lua
    }
    if (option == "ClearDestination")
    {
        destinationMarker.style.display = "none"; //Hide destination marker
        CallEvent("ClearMapDestination", null); //Call event to main.lua so that the in game destination waypoint is destroyed.
    }
    if (option == "TeleportHere")
    {
        teleportX = MapHelper.UIPixelToWorldX(menuX)
        teleportY = MapHelper.UIPixelToWorldY(menuY)
        CallEvent("RequestTeleportToLocation", teleportX, teleportY) //Call event to main.lua with x,y coordinates so that client can call remote event to server with coordinates
    }
}

function AssignParameters(_windowWidth, _windowHeight) //After the WebUI is loaded, a callback event is called 'OnMapUILoaded' where the map.lua will call AssignParameters and pass in the window Width/Height
{
    windowWidth = Math.floor(_windowWidth);
    windowHeight = Math.floor(_windowHeight);
    RefreshMap(mapScale);
}

function EnableDevMode() //If mod is ran in dev mode, there is a teleport option added. When ran in game, this should be called by main.lua via ExecuteJS
{
    var menuOptions = document.getElementById("menu-options");
    var menuItem = document.createElement("li");
    menuItem.appendChild(document.createTextNode("Teleport Here"));
    menuItem.className = "menu-option";
    menuItem.onclick = function() { MenuOptionClicked("TeleportHere") };
    menuOptions.appendChild(menuItem);
}

function RefreshMap(prevMapScale) //This is intended to be called after scaling the map to recalculate the dx/dy offsets and reposition the map accordingly.
{
    var map = document.getElementById('mapimg');
    var mapdiv = document.getElementById('mapdiv');

    mapDivX = parseInt(mapdiv.style.left, 10); //Current Map X
    mapDivY = parseInt(mapdiv.style.top, 10); //Current Map Y

    map.width = mapWidth * mapScale; //Adjust Width for new Map Scale
    map.height = mapHeight * mapScale; //Adjust Height for new Map Scale

    factor = mapScale/prevMapScale;
    var dx = (mousePosX - mapDivX) * (factor-1);
    var dy = (mousePosY - mapDivY) * (factor-1);
    mapDivX = mapDivX - dx;
    mapDivY = mapDivY- dy;

    FixMapLocation(); //Adjusts map location if it is going off screen
    mapdiv.style.left = (mapDivX) + 'px';
    mapdiv.style.top = (mapDivY) + 'px';
    RefreshBlips(); //Adjust blip locations for landmarks
    RefreshPlayerMarker(); //Adjust player marker location
}

function FixMapLocation() //This function is called to ensure that the map does not go off the screen.
{
    var mapimg = document.getElementById('mapimg');
    
    if (mapDivX > windowWidth*0.8)
    {
        mapDivX = windowWidth*0.8;
    }

    if ((mapDivX+mapimg.width) < windowWidth * 0.2)
    {
        mapDivX = windowWidth*0.2-mapimg.width;
    }

    if (mapDivY > windowHeight*0.8)
    {
        mapDivY = windowHeight*0.8;
    }

    if ((mapDivY+mapimg.height) < windowHeight * 0.2)
    {
        mapDivY = windowHeight*0.2-mapimg.height;
    }
}

function RefreshBlips() //Called when map is resized to reposition player marker.
{
    legendKeys.forEach(key =>
    {
        key.blips.forEach(blip =>
        {
            blip.style.left = (MapHelper.WorldToMapImgX(blip.worldX) * mapScale -12) + 'px';
            blip.style.top = (MapHelper.WorldToMapImgY(blip.worldY) * mapScale -12) + 'px';
        });
    });
    //Refresh destination (if one exists)
    var destinationMarker = document.getElementById("destinationmarker");
    if (destinationMarker.style.display == 'block') //If destination marker is visible, update position
    {
        destinationMarker.style.left = (MapHelper.WorldToMapImgX(destinationMarker.worldX) * mapScale -16) + 'px';
        destinationMarker.style.top = (MapHelper.WorldToMapImgY(destinationMarker.worldY) * mapScale - 32) + 'px';
    }
}

function RefreshPlayerMarker() //Called when map is resized to reposition player marker.
{
    var playerMarker = document.getElementById('playermarker');
    playerMarker.style.left = (playerMarker.imgX * mapScale -16) + 'px';
    playerMarker.style.top = (playerMarker.imgY * mapScale -16) + 'px';
}

function RegisterLegendKey(id, text, iconpath) //This should be called by main.lua via ExecuteJS for setting up a new legend key
{
    var key = [];
    key.id = id;
    key.text = text;
    key.iconpath = iconpath;
    key.blips = [];
    legendKeys.push(key);
    var legendKeyDiv = document.getElementById('legend-key');

    var keyDiv = document.createElement('div'); //create div for legend key
    keyDiv.style.display = 'block';
    keyDiv.style.whiteSpace = 'nowrap';

    var checkbox = document.createElement('input'); //create checkbox for legend key
    checkbox.type = 'checkbox';
    checkbox.id = 'checkbox_' + id;
    checkbox.checked = true;
    checkbox.onclick = function() { LegendKeyClick(id) }; 
    checkbox.className = 'checkbox-custom';

    var img = document.createElement('img'); //create img icon for legend key
    img.src = iconpath;
    img.className = 'legend-img';
    img.draggable = false;

    var label = document.createElement('label') //create label for legend key text
    label.htmlFor = checkbox.id;
    label.style.fontSize = '24px';
    label.textContent = text;

    keyDiv.appendChild(checkbox);
    keyDiv.appendChild(img);
    keyDiv.appendChild(label);

    legendKeyDiv.appendChild(keyDiv);
}

function RegisterBlip(id, worldX, worldY) //This should be called by main.lua via ExecuteJS for setting up a new blip AFTER the legend key for this "id" has been assigned.
{
    var key = null;
    legendKeys.forEach(e =>
        {
            if (e.id == id)
            {
                key = e;
            }
        });
    if (key != null)
    {
        var blipimg = document.createElement('img');
        blipimg.src = key.iconpath;
        blipimg.className = "blip";
        blipimg.draggable = false;
        blipimg.worldX = worldX;
        blipimg.worldY = worldY;
        blipimg.style.zIndex = 3;
        blipimg.style.left = (MapHelper.WorldToMapImgX(blipimg.worldX) * mapScale -12) + 'px';
        blipimg.style.top = (MapHelper.WorldToMapImgY(blipimg.worldY) * mapScale -12) + 'px';
        key.blips.push(blipimg);

        var mapdiv = document.getElementById('mapdiv');
        mapdiv.appendChild(blipimg);
    }
}

function LegendKeyClick(id) //This is called from one of the checkboxes that each legend key has
{
    var cb = document.getElementById('checkbox_'+id);
    var key = null;
    legendKeys.forEach(e => //forEach loop to get the legend key that the id is tied to
    {
        if (e.id == id)
        {
            key = e;
        }
    });
    //If checked, show all blips, if unchecked, hide all blips
    if (cb.checked == true)
    {
        key.blips.forEach(element => 
        {
            element.style.visibility = 'visible';
        });
    }
    else
    {
        key.blips.forEach(element => 
        {
            element.style.visibility = 'hidden';
        });
    }
}

function UpdatePlayerPosition(worldX, worldY, worldZ, angle) //Called from map.lua - updates the player marker location/rotation
{
    var playerMarker = document.getElementById('playermarker');
    playerMarker.imgX = MapHelper.WorldToMapImgX(worldX);
    playerMarker.imgY = MapHelper.WorldToMapImgY(worldY);
    playerMarker.style.transform = 'rotate('+Math.floor(angle)+'deg)';
    RefreshPlayerMarker();
}

class MapHelper //Map Helper class for all of the map math calculations
{
    static WorldToMapImgX(worldX)
    {
        return (worldX + 234002.2054794521) / 241.041095890411;
    }

    static WorldToMapImgY(worldY)
    {
        return (worldY + 231101.3928571428) / 242.5535714285714;
    }

    static WorldToMapDivX(worldX)
    {
        return this.WorldToMapImgX(worldX) * mapScale;
    }

    static WorldToMapDivY(worldY)
    {
        return this.WorldToMapImgY(worldY) * mapScale;
    }

    static MapImgToWorldX(mapDivX)
    {
        return 241.041095890411 * mapDivX - 234002.2054794521;
    }

    static MapImgToWorldY(mapDivY)
    {
        return 242.5535714285714 * mapDivY - 231101.3928571428;
    }

    static UIPixelToWorldX(uiPixel) 
    {
        var mapDivX = this.UIPixelToMapImgX(uiPixel)
        var worldX = this.MapImgToWorldX(mapDivX)
        return worldX
    }

    static UIPixelToWorldY(uiPixel) 
    {
        var mapDivY = this.UIPixelToMapImgY(uiPixel)
        var worldY = this.MapImgToWorldY(mapDivY)
        return worldY
    }

    static UIPixelToMapImgX(uiPixel)
    {
        var mapdiv = document.getElementById('mapdiv');
        uiPixel = uiPixel - parseInt(mapdiv.style.left);
        uiPixel = uiPixel / mapScale;
        return uiPixel;
    }

    static UIPixelToMapImgY(uiPixel) 
    {
        var mapdiv = document.getElementById('mapdiv');
        uiPixel = uiPixel - parseInt(mapdiv.style.top);
        uiPixel = uiPixel / mapScale;
        return uiPixel;
    }

    static UIPixelToMapDivX(uiPixel) //Takes a coordinate in UI space (ex. topleft is 0,0) and converts it to the current map div space for the map div. 
    {
        var mapdiv = document.getElementById('mapdiv');
        uiPixel = uiPixel - parseInt(mapdiv.style.left);
        return uiPixel;
    }

    static UIPixelToMapDivY(uiPixel) //Takes a coordinate in UI space (ex. topleft is 0,0) and converts it to the current map div space for the map div. 
    {
        var mapdiv = document.getElementById('mapdiv');
        uiPixel = uiPixel - parseInt(mapdiv.style.top);
        return uiPixel;
    }
}