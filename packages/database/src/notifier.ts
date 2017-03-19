import { DataListener, EventType } from './database-internal';
import { DataSnapshot } from './data-snapshot';
import { DataModel } from './data-model';
import { Path } from './path';
import { Subject } from 'rxjs/Subject';
import { Observable, ObservableInput } from 'rxjs/Observable';
import 'rxjs/add/operator/map';
import 'rxjs/add/operator/filter';
import 'rxjs/add/operator/share';

/**
 * @internal
 */
export class Notifier {
  private _subject = new Subject<NotifierEvent>();
  private _paused = false;

  /**
   * Prevents the notifier from processing and emitting any new events. Useful when bootstrapping.
   */
  pause() {
    this._paused = true;
  }

  /**
   * Tells the notifier to resume processing and emitting any new events
   */
  resume() {
    this._paused = false;
  }

  forListener(listener: DataListener, mergeWith?: ObservableInput<NotifierEvent>): Observable<DataSnapshot> {
    let notifier$ = this._subject.asObservable();

    if (mergeWith) {
      notifier$ = notifier$.merge(mergeWith);
    }

    return notifier$
      .filter((event: NotifierEvent): boolean => {
        // TODO: take query options into account

        return (!event.tag || (event.tag === listener.tag))
          && (event.type === listener.type)
          && listener.query.path.isEqual(event.path);
      })
      .map((event: NotifierEvent): DataSnapshot => new DataSnapshot(listener.query, event.model));
  }

  trigger(path: Path,
          oldModel: DataModel,
          newModel: DataModel,
          tag = 0,
          bubbleUpValue = false,
          bubbleUpChildChangedUntil: Path = null,
          downLevels = Infinity,
          _subject?: Subject<NotifierEvent>) {

    if (this._paused) {
      return;
    }

    if (newModel.hasChildren()) {
      if (downLevels > 0) {
        downLevels -= 1;

        newModel.forEachChild((key: string, child: DataModel) => {
          this.trigger(path.child(key), oldModel.child(key), child, tag, false, path, downLevels, _subject);
        });
      }
    }

    // In general we emit on the notifier's own subject, but in some cases we want to emit on
    // some other subject. For example, when emiting cached data for a single listener.
    const subject = _subject || this._subject;

    let parentPath = path.parent;

    if (parentPath) {

      // TODO: detect and trigger "child_moved" events
      // TODO: take query (tag) into account. It might affect child added/removed

      // Check for child added, removed, changed
      if (oldModel.exists()) {
        if (!newModel.exists()) {
          // Trigger "child_removed" on the parent for this node
          if (path.parent)
            subject.next({type: 'child_removed', path: parentPath, model: oldModel, tag});

          // Trigger value and child_removed for any descendants
          this.cascadeNodeRemoved(path, oldModel, tag, false);
        } else {
          // Trigger "child changed" event for this node
          subject.next({type: 'child_changed', path: parentPath, model: newModel, tag});
        }
      } else {
        if (newModel.exists()) {
          subject.next({type: 'child_added', path: parentPath, model: newModel, tag});
        }
      }

      // Bubble up a "child_changed" event for any ancestors of this
      // node's parent (up to the specified one to avoid duplicate events)
      let model = newModel.parent;
      parentPath = parentPath.parent;

      while (parentPath && !parentPath.includesOrEqualTo(bubbleUpChildChangedUntil)) {
        subject.next({type: 'child_changed', path: parentPath, model: model, tag});
        parentPath = parentPath.parent;
        model = model.parent;
      }
    }

    subject.next({type: 'value', path: path, model: newModel, tag});

    if (bubbleUpValue) {
      // bubble up a "value" event for any ancestors of this node
      let bubbleUpModel = newModel;
      let bubbleUpPath = path;

      while (bubbleUpModel.parent) {
        subject.next({type: 'value', path: bubbleUpPath.parent, model: bubbleUpModel.parent, tag});
        bubbleUpModel = bubbleUpModel.parent;
        bubbleUpPath = bubbleUpPath.parent;
      }
    }
  }

  private cascadeNodeRemoved(path: Path, model: DataModel, tag?: number, valueEvent = true) {
    if (model.hasChildren()) {
      model.children.forEach((child: DataModel) => {
        // Recursively process any children
        this.cascadeNodeRemoved(path.child(child.key), child, tag);

        // trigger a "child_removed" event on the path (parent) for this child
        this._subject.next({type: 'child_removed', path: path, model: child, tag});
      });

      if (valueEvent) {
        // Trigger a "value" evnet for this node
        this._subject.next({type: 'value', path: path, model, tag});
      }
    }
  }

}


/**
 * @internal
 */
export interface NotifierEvent {
  type: EventType;
  path: Path;
  model: DataModel;
  tag?: number; // Query tag
}
